import Koa from "koa";
import Router from "@koa/router";
import send from "koa-send";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import mimetype from "mimetype";
import {
  ReleaseFile,
  buildReleaseFileName,
  ProductFile,
  parseProductFileName,
  buildProductFileName,
  ProductTableFile,
  getTypeAndIdentifierFromFileName,
  buildTransactionFileName,
  buildBlobFileName,
  TransactionFile,
  ProductTableFileColumn,
  ProductTableFileRow,
  parseTransactionFileName,
  builtinIdColumnName,
  builtinParentIdColumnName,
  RootFile,
  buildRootFileName,
  TreeFile,
} from "../file-types";
import { ApiProduct, ApiTables, Mutable, ApiMarker, ApiTableRow } from "./types";
import compose from "koa-compose";
import { getDatabaseId } from "../context-parsing";
import { withSpan } from "../tracing";

const existsAsync = promisify(fs.exists);
const readFileAsync = promisify(fs.readFile);

export interface GetFilesDir {
  (databaseId: string): string;
}

export interface GetBaseUrl {
  (ctx: Koa.Context, databaseId: string): string;
}

const cacheNeverHeader: Koa.Middleware = (ctx: Router.RouterContext, next: Next): Promise<unknown> => {
  ctx.set("cache-control", "no-cache, max-age=0");
  return next();
};

const cacheForeverHeader: Koa.Middleware = (ctx: Router.RouterContext, next: Next): Promise<unknown> => {
  ctx.set("cache-control", "public, max-age=86400");
  return next();
};

export function createClientRestMiddleware(
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  prefix?: string
): Koa.Middleware {
  const router = new Router({ prefix });

  // Cacheable immutable data
  router.get(
    "/:database_id/(public/)?transactions/:tx/products/:product_id/tables/:table",
    dataForTableHandler(getFilesDir, getBaseUrl),
    cacheForeverHeader
  );
  router.get(
    "/:database_id/(public/)?transactions/:tx/products/:product_id/tables",
    tablesForProductHandler(getFilesDir, getBaseUrl),
    cacheForeverHeader
  );
  router.get(
    "/:database_id/(public/)?transactions/:tx/products/:product_id",
    allTableDataForProductHandler(getFilesDir, getBaseUrl),
    cacheForeverHeader
  ); // ?tables=T1,T2...
  router.get(
    "/:database_id/(public/)?transactions/:tx",
    productsForTransactionHandler(getFilesDir, getBaseUrl),
    cacheForeverHeader
  ); // ?tables=T1,T2...
  router.get(
    "/:database_id/(public/)?releases/:id",
    productsForReleaseHandler(getFilesDir, getBaseUrl),
    cacheForeverHeader
  ); // ?tables=T1,T2...
  router.get("/:database_id/(public/)?blobs/:hash", blobHandler(getFilesDir), cacheForeverHeader);

  // Entry files
  router.get("/:database_id/(public/)?markers", markersHandler(getFilesDir, getBaseUrl), cacheNeverHeader);
  router.get("/:database_id/(public/)?markers/:name", markerHandler(getFilesDir, getBaseUrl), cacheNeverHeader);
  router.get("/:database_id/(public/)?latest", latestHandler(getFilesDir, getBaseUrl), cacheNeverHeader); // Renamed in V3 working -> latest

  // Trees are not cache:able
  router.get("/:database_id/(public/)?trees", treesHandler(getFilesDir), cacheNeverHeader);

  return compose([router.routes(), router.allowedMethods()]);
}

/***************************
 * Handlers
 ***************************/

type Next = () => Promise<unknown>;

function treesHandler(getFilesDir: GetFilesDir): Koa.Middleware {
  return async function _treesHandler(ctx: Router.RouterContext, next: Next): Promise<unknown> {
    return await withSpan("treesHandler", async (_span) => {
      const rootFileContent = await readJsonFile<RootFile>(getFilesDir(getDatabaseId(ctx, false)), buildRootFileName());
      const trees: Array<TreeFile> = [];
      for (const t of Object.keys(rootFileContent.data.trees)) {
        const fileName = rootFileContent.refs[rootFileContent.data.trees[t]];
        trees.push(await treeFileNameToTreeFile(ctx, getFilesDir, fileName));
      }
      ctx.body = trees;
      return next();
    });
  };
}

function blobHandler(getFilesDir: GetFilesDir): Koa.Middleware {
  return async function _blobHandler(ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const blobFileName = buildBlobFileName(ctx.params.hash);
    const fileName = ctx.query["file"];
    const attachment = ctx.query["attachment"];
    const fullPath = path.join(getFilesDir(getDatabaseId(ctx, false)), blobFileName);
    if (!(await existsAsync(fullPath))) {
      ctx.status = 404;
      ctx.body = "Not found";
      return;
    }
    const contentType = mimetype.lookup(fileName || "file");
    if (contentType) {
      ctx.headers["Content-Type"] = contentType;
    } else {
      ctx.headers["Content-Type"] = "application/octet-stream";
    }

    if (fileName && attachment) {
      ctx.headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
    }

    await send(ctx, blobFileName, { root: getFilesDir(getDatabaseId(ctx, false)) });
    return next();
  };
}

function latestHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function _latestHandler(ctx: Router.RouterContext, _next: Next): Promise<unknown> {
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(getDatabaseId(ctx, false)), buildRootFileName());
    const urlToProducts = `${getBaseUrl(ctx, getDatabaseId(ctx, false))}/transactions/${
      rootFileContent.data.latest.tx
    }`;
    const apiMarker = {
      transaction_id: rootFileContent.data.latest.tx.toString(),
      date: rootFileContent.data.latest.date,
      products: urlToProducts,
    };
    ctx.body = apiMarker;
    return _next();
  };
}

function productsForTransactionHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function (ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const tx: string = ctx.params.tx;
    const legacyTableList: ReadonlyArray<string> = ctx.query["tables"] ? ctx.query["tables"].split(",") : undefined;
    // Read the release file
    const transactionFile = await readJsonFile<TransactionFile>(
      getFilesDir(getDatabaseId(ctx, false)),
      buildTransactionFileName(tx)
    );
    // Fetch all product file names for the release
    const productFileNames = Object.values(transactionFile.data.products).map((ref) => transactionFile.refs[ref]);
    const apiProducts = await getApiProductsForFileNames(
      ctx,
      getFilesDir,
      getBaseUrl,
      productFileNames,
      legacyTableList
    );
    ctx.body = apiProducts;
    return next();
  };
}

function productsForReleaseHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function (ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const releaseId: string = ctx.params.id;
    const legacyTableList: ReadonlyArray<string> = ctx.query["tables"] ? ctx.query["tables"].split(",") : undefined;
    // Read the release file
    const releaseFile = await readJsonFile<ReleaseFile>(
      getFilesDir(getDatabaseId(ctx, false)),
      buildReleaseFileName(releaseId)
    );
    // Fetch all product file names for the release
    const productFileNames = Object.values(releaseFile.data.products).map((ref) => releaseFile.refs[ref]);
    const apiProducts = await getApiProductsForFileNames(
      ctx,
      getFilesDir,
      getBaseUrl,
      productFileNames,
      legacyTableList
    );
    ctx.body = apiProducts;
    return next();
  };
}

function markerHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function _markersHandler(ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const markerName = ctx.params.name;
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(getDatabaseId(ctx, false)), buildRootFileName());
    const markerKey = Object.keys(rootFileContent.data.markers).find(
      (m) => m.toLowerCase() === markerName.toLowerCase()
    );
    if (markerKey === undefined) {
      ctx.status = 404;
      ctx.body = "Not found";
      return;
    }
    const markerRef = rootFileContent.data.markers[markerKey];
    const fileName = rootFileContent.refs[markerRef];
    const apiMarker = await markerFileNameToApiMarker(ctx, getFilesDir, getBaseUrl, markerName, fileName);
    ctx.body = apiMarker;
    return next();
  };
}

function markersHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function _markersHandler(ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(getDatabaseId(ctx, false)), buildRootFileName());
    const apiMarkers: Array<ApiMarker> = [];
    for (const m of Object.keys(rootFileContent.data.markers)) {
      const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
      apiMarkers.push(await markerFileNameToApiMarker(ctx, getFilesDir, getBaseUrl, m, fileName));
    }
    ctx.body = apiMarkers;
    return next();
  };
}

function tablesForProductHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function (ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const productId: string = ctx.params.product_id;
    const tx = ctx.params.tx;
    const content = await readJsonFile<ProductFile>(
      getFilesDir(getDatabaseId(ctx, false)),
      buildProductFileName(productId, tx)
    );

    const tableNames = Object.keys(content.data.tables);
    const rootTableNames = filterRootTables(tableNames);
    const apiTables = rootTableNames.map((fullTableName) => {
      const compatibleTableName = fullToLegacyTableName(fullTableName);
      return {
        name: compatibleTableName,
        uri: `${getBaseUrl(
          ctx,
          getDatabaseId(ctx, false)
        )}/transactions/${tx}/products/${productId}/tables/${compatibleTableName}`,
      };
    });
    ctx.body = apiTables;
    return next();
  };
}

function dataForTableHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function _dataForProductTableHandler(ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const legacyTableName: string = ctx.params.table;
    const productId: string = ctx.params.product_id;
    const tx: string = ctx.params.tx;
    // var variant = request.requestedUri.queryParameters['variant'] != null ?
    // PropertyValueSet.parse(request.requestedUri.queryParameters['variant'], (_) => null) : null;

    // Read the product file and build it's tables
    const filesDir = getFilesDir(getDatabaseId(ctx, false));
    const baseUrl = getBaseUrl(ctx, getDatabaseId(ctx, false));
    const productFile = await readJsonFile<ProductFile>(filesDir, buildProductFileName(productId, tx));
    const apiTables = await getApiProductTables(filesDir, baseUrl, productFile, [legacyTableName]);
    const foundTable = apiTables[legacyTableName];
    if (!foundTable) {
      ctx.status = 404;
      ctx.body = "Not found";
      return;
    }
    ctx.body = foundTable;
    return next();
  };
}

function allTableDataForProductHandler(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async function (ctx: Router.RouterContext, next: Next): Promise<unknown> {
    const productId: string = ctx.params.product_id;
    const tx: string = ctx.params.tx;
    const legacyTableList: ReadonlyArray<string> = ctx.query["tables"] ? ctx.query["tables"].split(",") : undefined;
    // const variant =
    //   ctx.query["variant"] !== null ? PropertyValueSet.parse(ctx.query["variant"], () => undefined) : undefined;
    // var numbers = request.requestedUri.queryParameters['numbers'] == "true";

    // Read the product file and build it's tables
    const filesDir = getFilesDir(getDatabaseId(ctx, false));
    const baseUrl = getBaseUrl(ctx, getDatabaseId(ctx, false));
    const productFile = await readJsonFile<ProductFile>(filesDir, buildProductFileName(productId, tx));
    const apiTables = await getApiProductTables(filesDir, baseUrl, productFile, legacyTableList || ["*"]);
    ctx.body = apiTables;
    return next();
  };
}

/***************************
 * Internal functions
 ***************************/

async function markerFileNameToApiMarker(
  ctx: Koa.Context,
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  markerName: string,
  fileName: string
): Promise<ApiMarker> {
  const typeAndId = getTypeAndIdentifierFromFileName(fileName);
  let urlToProducts = "";
  let apiMarker: ApiMarker;
  if (typeAndId.type === "release") {
    const releaseContent = await readJsonFile<ReleaseFile>(getFilesDir(getDatabaseId(ctx, false)), fileName);
    urlToProducts = `${getBaseUrl(ctx, getDatabaseId(ctx, false))}/releases/${typeAndId.identifier}`;
    apiMarker = {
      marker_name: markerName,
      release_name: releaseContent.data.name,
      release_id: releaseContent.data.id.toUpperCase(),
      products: urlToProducts,
    };
  } else if (typeAndId.type === "transaction") {
    const parsed = parseTransactionFileName(fileName);
    const tx = parsed.tx;
    urlToProducts = `${getBaseUrl(ctx, getDatabaseId(ctx, false))}/transactions/${tx}`;
    apiMarker = {
      marker_name: markerName,
      transaction_id: tx.toString(),
      products: urlToProducts,
    };
  } else {
    throw new Error("Invalid file type.");
  }
  return apiMarker;
}

async function treeFileNameToTreeFile(ctx: Koa.Context, getFilesDir: GetFilesDir, fileName: string): Promise<TreeFile> {
  const typeAndId = getTypeAndIdentifierFromFileName(fileName);
  let apiTree: TreeFile;
  if (typeAndId.type === "tree") {
    const treeContent = await readJsonFile<TreeFile>(getFilesDir(getDatabaseId(ctx, false)), fileName);
    apiTree = {
      id: treeContent.id,
      name: treeContent.name,
      relations: treeContent.relations,
    };
  } else {
    throw new Error("Invalid file type.");
  }
  return apiTree;
}

async function getApiProductWithOptionalTables(
  ctx: Koa.Context,
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  productFileName: string,
  legacyTableList: ReadonlyArray<string> | undefined
): Promise<ApiProduct> {
  // Read the product file
  const productFile: ProductFile = await readJsonFile<ProductFile>(
    getFilesDir(getDatabaseId(ctx, false)),
    productFileName
  );

  // Build the ApiProduct object
  const parsed = parseProductFileName(productFileName);
  const filesDir = getFilesDir(getDatabaseId(ctx, false));
  const baseUrl = getBaseUrl(ctx, getDatabaseId(ctx, false));
  const p: Mutable<ApiProduct> = {
    id: productFile.data.id.toUpperCase(),
    key: productFile.data.key,
    name: productFile.data.name,
    retired: productFile.data.retired,
    transaction_id: parsed.tx,
    tables: `${baseUrl}/transactions/${parsed.tx}/products/${parsed.productId}/tables`,
    all_tables: `${baseUrl}/transactions/${parsed.tx}/products/${parsed.productId}`,
  };
  // If query-string parameter "tables" is specified, then we should return an extra
  // key called "data" for every product that contains the table data.
  if (legacyTableList) {
    const apiTables = await getApiProductTables(filesDir, baseUrl, productFile, legacyTableList);
    p.data = apiTables;
  }
  return p;
}

async function getApiProductTables(
  filesDir: string,
  baseUrl: string,
  productFile: ProductFile,
  legacyTableList: ReadonlyArray<string>
): Promise<ApiTables> {
  // Build the tables
  const apiTables: Mutable<ApiTables> = {};
  let tableKeys = Object.keys(productFile.data.tables);

  // Only include those that are specified, or all if * is specified, or none if not specified
  if (legacyTableList.indexOf("*") === -1) {
    tableKeys = tableKeys.filter((tableName) => legacyTableList.indexOf(fullToLegacyTableName(tableName)) !== -1);
  }

  // Remove legacy child tables
  const tableKeysWithoutRoot = filterRootTables(tableKeys);

  // Read table file contents
  const tableFileNames = tableKeysWithoutRoot.map((tableName) => productFile.refs[productFile.data.tables[tableName]]);
  const promises = tableFileNames.map((f) => readJsonFile<ProductTableFile>(filesDir, f));
  const tableFilesContent: ReadonlyArray<ProductTableFile> = await Promise.all(promises);
  // Map to the API objects to return
  for (const tableFile of tableFilesContent) {
    const fullTableName = buildFullTableName(tableFile);
    const childTableContent = await readChildTablesRecursive(productFile, filesDir, fullTableName);
    const rows = mapFileRowsToApiRows(
      baseUrl,
      childTableContent,
      buildFullTableName(tableFile),
      tableFile.data.columns,
      tableFile.data.rows
    );
    apiTables[fullToLegacyTableName(fullTableName)] = rows;
  }
  return apiTables;
}

function buildFullTableName(tableFile: ProductTableFile): string {
  return `${tableFile.data.module}@${tableFile.data.name}`;
}

function fullToLegacyTableName(prefixedTableName: string): string {
  // The convention is module@table
  const parts = prefixedTableName.split("@");
  const module = parts[0];
  const prefix = module === "custom_tables" ? "ct_" : "";
  const tableName = parts[1];
  const compatibleTableName = prefix + tableName;
  return compatibleTableName;
}

function mapFileRowsToApiRows(
  baseUrl: string,
  childTableContent: LoadedTables,
  tableName: string,
  fileColumns: ReadonlyArray<ProductTableFileColumn>,
  fileRows: ReadonlyArray<ProductTableFileRow>
): ReadonlyArray<ApiTableRow> {
  // Read any child table files and send them along (to avoid reading them for every row)
  const rows = fileRows.map((fileRow) => {
    const apiRow: Mutable<ApiTableRow> = {};
    for (let c = 0; c < fileColumns.length; c++) {
      const column = fileColumns[c];
      // Don't add internal columns id and parent_id
      if (column.name !== builtinIdColumnName && column.name !== builtinParentIdColumnName) {
        if (column.type === "Blob") {
          apiRow[column.name] = fileRow[c] && baseUrl + "/blobs/" + fileRow[c];
        } else {
          apiRow[column.name] = fileRow[c];
        }
      }
    }
    addChildTableFieldsToRow(baseUrl, childTableContent, tableName, fileColumns, fileRow, apiRow);
    return apiRow;
  });
  return rows;
}

// Some tables had child tables embedded in v2 of the Client REST API, we
// have some code here to replicate that for those tables
// (For new tables we use a flat structure instead)
function addChildTableFieldsToRow(
  baseUrl: string,
  childTableContent: LoadedTables,
  tableName: string,
  fileColumns: ReadonlyArray<ProductTableFileColumn>,
  fileRow: ProductTableFileRow,
  apiRow: Mutable<ApiTableRow>
): void {
  const childTables = legacyChildTables2[tableName];
  if (childTables) {
    childTables.map((ct) => {
      // Find the child table
      const childTableFile = childTableContent[ct.child];
      if (childTableFile) {
        // Filter rows BEFORE mapping them to avoid mapping rows that will be filtered away
        const idColumnIndex = fileColumns.findIndex((c) => c.name === builtinIdColumnName);
        const id = fileRow[idColumnIndex];
        const childParentIdColumnIndex = childTableFile.data.columns.findIndex(
          (c) => c.name === builtinParentIdColumnName
        );
        const filteredFileRows = childTableFile.data.rows.filter((r) => r[childParentIdColumnIndex] === id);
        const filteredApiRows = mapFileRowsToApiRows(
          baseUrl,
          childTableContent,
          buildFullTableName(childTableFile),
          childTableFile.data.columns,
          filteredFileRows
        );
        apiRow[ct.parentField] = filteredApiRows;
      } else {
        console.warn(`Missing child table '${ct.child}'.`);
      }
    });
  }
}

async function readChildTablesRecursive(
  pf: ProductFile,
  filesDir: string,
  parentTableName: string
): Promise<LoadedTables> {
  let childTableContent: Mutable<LoadedTables> = {};
  const childTables = legacyChildTables2[parentTableName];
  if (childTables) {
    for (const childTableDef of childTables) {
      // Read the child table's file
      const childTableName = childTableDef.child;
      const childTableFileName = pf.refs[pf.data.tables[childTableName]];
      if (childTableFileName) {
        const childTable = await readJsonFile<ProductTableFile>(filesDir, childTableFileName);
        childTableContent[childTableDef.child] = childTable;
      }
      // If this child table has children of it's own then recurse
      const subChildTables = legacyChildTables2[childTableDef.child];
      if (subChildTables) {
        const subChildren = await readChildTablesRecursive(pf, filesDir, childTableDef.child);
        childTableContent = { ...childTableContent, ...subChildren };
      }
    }
  }
  return childTableContent;
}

interface LoadedTables {
  readonly [table: string]: ProductTableFile;
}

async function getApiProductsForFileNames(
  ctx: Koa.Context,
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  productFileNames: ReadonlyArray<string>,
  legacyTableList: ReadonlyArray<string>
): Promise<ReadonlyArray<ApiProduct>> {
  // Create all products in parallell
  const apiProductPromises = productFileNames.map((f) =>
    getApiProductWithOptionalTables(ctx, getFilesDir, getBaseUrl, f, legacyTableList)
  );
  const apiProducts = await Promise.all(apiProductPromises);
  return apiProducts;
}

function filterRootTables(tableNames: ReadonlyArray<string>): ReadonlyArray<string> {
  // This is to be compatible with v2 which only returns root tables, it was done the same way in Dart
  return tableNames.filter((t) => t.indexOf(".") === -1 && t !== "magicloud");
}

interface LegacyChildTablesPerParent {
  readonly [parent: string]: ReadonlyArray<ChildTableDef>;
}

interface ChildTableDef {
  readonly child: string;
  readonly parentField: string;
}

const legacyChildTables2: LegacyChildTablesPerParent = {
  "properties@property": [
    {
      child: "properties@property.value",
      parentField: "value",
    },
    {
      child: "properties@property.translation",
      parentField: "translation",
    },
    {
      child: "properties@property.def_value",
      parentField: "def_value",
    },
  ],
  "properties@property.value": [
    {
      child: "properties@property.value.translation",
      parentField: "translation",
    },
  ],
  "shape@shape": [
    {
      child: "shape@shape.size",
      parentField: "size",
    },
  ],
  "market@market": [
    {
      child: "market@market.price",
      parentField: "price",
    },
  ],
  "sound@sound_variant": [
    {
      child: "sound@sound_variant.damper",
      parentField: "damper",
    },
    {
      child: "sound@sound_variant.sound",
      parentField: "sound",
    },
    {
      child: "sound@sound_variant.sound_line",
      parentField: "sound_line",
    },
  ],
  "models@model": [
    {
      child: "models@model.params",
      parentField: "params",
    },
  ],
};

async function readJsonFile<T>(filesDir: string, fileName: string): Promise<T> {
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
}
