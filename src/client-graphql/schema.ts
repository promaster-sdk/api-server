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
import { queryResolvers, markerResolvers, productResolvers } from "./resolvers";
import { ProductFile, ProductTableFile, ProductTableFileColumn, ReleaseFile, TransactionFile } from "../file-types";
import { GetFilesDir } from "./context";
import Koa from "koa";
import { readJsonFile, toSafeName, getProductTables } from "./read-files";

export async function createSchema(
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir,
  releaseOrTransactionFileName: string
): Promise<GraphQLSchema> {
  const usedTypeNames = new Set<string>();

  // Read the file that the marker points to, it is either a Release or Transaction file
  const releaseOrTransaction = await readJsonFile<ReleaseFile | TransactionFile>(
    getFilesDir(koaCtx),
    releaseOrTransactionFileName
  );
  const productFileNames = Object.values(releaseOrTransaction.data.products).map(
    (ref) => releaseOrTransaction.refs[ref]
  );

  const treeRelation = new GraphQLObjectType({
    name: getUniqueTypeName("TreeRelation", usedTypeNames),
    fields: {
      parentId: { type: GraphQLID },
      childId: { type: new GraphQLNonNull(GraphQLID) },
      sortNo: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });

  const treeType = new GraphQLObjectType({
    name: getUniqueTypeName("Tree", usedTypeNames),
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      relations: {
        type: new GraphQLNonNull(GraphQLList(treeRelation)),
      },
    },
  });

  const queryType = new GraphQLObjectType({
    name: getUniqueTypeName("Query", usedTypeNames),
    fields: {
      trees: {
        type: new GraphQLList(treeType),
        resolve: queryResolvers.trees,
      },
      marker: {
        type: await buildMarkerType(koaCtx, getFilesDir, productFileNames, usedTypeNames),
        resolve: queryResolvers.marker,
      },
    },
  });

  return new GraphQLSchema({ query: queryType });
}

async function buildMarkerType(
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir,
  productFileNames: ReadonlyArray<string>,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const tablesType = await buildTablesType(productFileNames, koaCtx, getFilesDir, usedTypeNames);
  const productType = await buildProductType(tablesType, usedTypeNames);
  return new GraphQLObjectType({
    name: getUniqueTypeName("Marker", usedTypeNames),
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

async function buildProductType(tablesType: GraphQLObjectType, usedTypeNames: Set<string>): Promise<GraphQLObjectType> {
  const productType = new GraphQLObjectType({
    name: getUniqueTypeName("Product", usedTypeNames),
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
  productFileNames: ReadonlyArray<string>,
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const tableDefs = await getUniqueTableDefinitions(productFileNames, koaCtx, getFilesDir);
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableDefs)) {
    const tableFieldName = toSafeName(n);
    fields[tableFieldName] = { type: await buildTableType(tableFieldName, v, usedTypeNames) };
  }
  const tablesType = new GraphQLObjectType({ name: getUniqueTypeName("Tables", usedTypeNames), fields });
  return tablesType;
}

function getUniqueTypeName(requestedName: string, usedTypeNames: Set<string>): string {
  let nameToUse = requestedName;
  if (usedTypeNames.has(requestedName)) {
    nameToUse = requestedName + "_MAKEUNIQUE";
  }
  usedTypeNames.add(nameToUse);
  return nameToUse;
}

async function buildTableType(
  tableSafeName: string,
  columns: ReadonlyArray<ProductTableFileColumn>,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const tableType = new GraphQLObjectType({
    name: getUniqueTypeName(tableSafeName, usedTypeNames),
    fields: Object.fromEntries(columns.map((c) => [toSafeName(c.name), { type: GraphQLString }])),
  });
  return tableType;
}

interface ColumnsPerTable {
  readonly [tableName: string]: ReadonlyArray<ProductTableFileColumn>;
}

// All tables that have the same structure can be merged...
async function getUniqueTableDefinitions(
  productFileNames: ReadonlyArray<string>,
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir
): Promise<ColumnsPerTable> {
  // const productFileNames = await getMarkerProductFileNames(koaCtx, getFilesDir, marker.releaseId, marker.transactionId);
  const productFilePromises = productFileNames.map((f) => readJsonFile<ProductFile>(getFilesDir(koaCtx), f));
  const productFiles = await Promise.all(productFilePromises);
  const tableFilePromises = productFiles.map((f) => getProductTables(getFilesDir(koaCtx), f));
  const tableFiles = await Promise.all(tableFilePromises);
  const allTableFiles: ReadonlyArray<ProductTableFile> = tableFiles.flat();
  // TODO: For tables that have the same name but not the same columns, create a generated unique name
  return Object.fromEntries(allTableFiles.map((t) => [toSafeName(t.data.name), t.data.columns]));
}
