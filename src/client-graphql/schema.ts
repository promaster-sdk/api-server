import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLBoolean,
  GraphQLFieldConfigMap,
} from "graphql";
import { queryResolvers, markerResolvers, productResolvers, markersResolver } from "./resolvers";
import { RootFile, buildRootFileName, ProductFile, ProductTableFile, ProductTableFileColumn } from "../file-types";
import { GetFilesDir } from "./context";
import Koa from "koa";
import {
  getMarkerForReleaseOrTransactionFileName,
  readJsonFile,
  toSafeName,
  getMarkerProductFileNames,
  getProductTables,
} from "./read-files";
import { Marker } from "./schema-types";

export async function createSchema(koaCtx: Koa.Context, getFilesDir: GetFilesDir): Promise<GraphQLSchema> {
  const treeRelation = new GraphQLObjectType({
    name: "TreeRelation",
    fields: {
      parentId: { type: GraphQLID },
      childId: { type: new GraphQLNonNull(GraphQLID) },
      sortNo: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });

  const treeType = new GraphQLObjectType({
    name: "Tree",
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      relations: {
        type: new GraphQLNonNull(GraphQLList(treeRelation)),
      },
    },
  });

  const queryType = new GraphQLObjectType({
    name: "Query",
    fields: {
      trees: {
        type: new GraphQLList(treeType),
        resolve: queryResolvers.trees,
      },
      markers: {
        type: await buildMarkersType(koaCtx, getFilesDir),
        resolve: markersResolver,
      },
    },
  });

  return new GraphQLSchema({ query: queryType });
}

// Every marker has a different schema since the products in the marker have different tables etc.
export async function buildMarkersType(koaCtx: Koa.Context, getFilesDir: GetFilesDir): Promise<GraphQLObjectType> {
  // Read all markers
  const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};

  for (const m of Object.keys(rootFileContent.data.markers)) {
    const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
    const marker = await getMarkerForReleaseOrTransactionFileName(koaCtx, getFilesDir, m, fileName);
    const safeMarkerName = toSafeName(marker.markerName);
    const markerType = await buildMarkerType(koaCtx, getFilesDir, safeMarkerName, marker);
    fields[safeMarkerName] = { type: markerType };
  }

  // const m = "ken";
  // const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
  // const marker = await getMarkerForReleaseOrTransactionFileName(koaCtx, getFilesDir, m, fileName);
  // const safeMarkerName = toSafeName(marker.markerName);
  // const markerType = await buildMarkerType(koaCtx, getFilesDir, safeMarkerName, marker);
  // fields[safeMarkerName] = { type: markerType };

  return new GraphQLObjectType({
    name: "Markers",
    fields,
  });
}

async function buildMarkerType(
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir,
  safeMarkerName: string,
  marker: Marker
): Promise<GraphQLObjectType> {
  const tablesType = await buildTablesType(marker, koaCtx, getFilesDir);
  const productType = await buildProductType(marker.markerName, tablesType);
  return new GraphQLObjectType({
    name: `Marker_${safeMarkerName}`,
    fields: {
      markerName: { type: new GraphQLNonNull(GraphQLString) },
      releaseId: { type: GraphQLString },
      releaseName: { type: GraphQLString },
      transactionId: { type: GraphQLString },
      products: {
        type: new GraphQLNonNull(GraphQLList(productType)),
        resolve: markerResolvers.products,
      },
    },
  });
}

async function buildProductType(markerName: string, tablesType: GraphQLObjectType): Promise<GraphQLObjectType> {
  const productType = new GraphQLObjectType({
    name: `Product_${toSafeName(markerName)}`,
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      key: { type: new GraphQLNonNull(GraphQLString) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      retired: { type: new GraphQLNonNull(GraphQLBoolean) },
      transactionId: { type: new GraphQLNonNull(GraphQLString) },
      tables: { type: tablesType, resolve: productResolvers.tables },
    },
  });
  return productType;
}

async function buildTablesType(
  marker: Marker,
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir
): Promise<GraphQLObjectType> {
  const tableDefs = await getUniqueTableDefinitions(marker, koaCtx, getFilesDir);
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableDefs)) {
    const tableSafeName = toSafeName(n);
    fields[tableSafeName] = { type: await buildTableType(marker.markerName, tableSafeName, v) };
  }
  const tablesType = new GraphQLObjectType({ name: `Tables_${toSafeName(marker.markerName)}`, fields });
  return tablesType;
}

async function buildTableType(
  markerName: string,
  tableSafeName: string,
  columns: ReadonlyArray<ProductTableFileColumn>
): Promise<GraphQLObjectType> {
  const tableType = new GraphQLObjectType({
    name: `Table_${toSafeName(markerName)}_${tableSafeName}`,
    fields: Object.fromEntries(columns.map((c) => [toSafeName(c.name), { type: GraphQLString }])),
  });
  return tableType;
}

interface ColumnsPerTable {
  readonly [tableName: string]: ReadonlyArray<ProductTableFileColumn>;
}

// All tables that have the same structure can be merged...
async function getUniqueTableDefinitions(
  marker: Marker,
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir
): Promise<ColumnsPerTable> {
  const productFileNames = await getMarkerProductFileNames(koaCtx, getFilesDir, marker.releaseId, marker.transactionId);
  const productFilePromises = productFileNames.map((f) => readJsonFile<ProductFile>(getFilesDir(koaCtx), f));
  const productFiles = await Promise.all(productFilePromises);
  const tableFilePromises = productFiles.map((f) => getProductTables(getFilesDir(koaCtx), f));
  const tableFiles = await Promise.all(tableFilePromises);
  const allTableFiles: ReadonlyArray<ProductTableFile> = tableFiles.flat();
  // TODO: For tables that have the same name but not the same columns, create a generated unique name
  return Object.fromEntries(allTableFiles.map((t) => [toSafeName(t.data.name), t.data.columns]));
}
