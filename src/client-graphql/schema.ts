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
import { toSafeName, getProductTables } from "./read-files";
import { Module } from "./schema-types";
import { ReadJsonFile } from "./context";

export async function createSchema(
  readJsonFile: ReadJsonFile,
  releaseOrTransactionFileName: string
): Promise<GraphQLSchema> {
  const usedTypeNames = new Set<string>();

  // Read the file that the marker points to, it is either a Release or Transaction file
  const releaseOrTransaction = await readJsonFile<ReleaseFile | TransactionFile>(releaseOrTransactionFileName);
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
        type: await buildMarkerType(readJsonFile, productFileNames, usedTypeNames),
        resolve: queryResolvers.marker,
      },
    },
  });

  return new GraphQLSchema({ query: queryType });
}

async function buildMarkerType(
  readJsonFile: ReadJsonFile,
  productFileNames: ReadonlyArray<string>,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const productType = await buildProductType(readJsonFile, productFileNames, usedTypeNames);
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

async function buildProductType(
  readJsonFile: ReadJsonFile,
  productFileNames: ReadonlyArray<string>,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const modulesType = await buildModulesType(productFileNames, readJsonFile, usedTypeNames);
  const productType = new GraphQLObjectType({
    name: getUniqueTypeName("Product", usedTypeNames),
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      key: { type: new GraphQLNonNull(GraphQLString) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      retired: { type: new GraphQLNonNull(GraphQLBoolean) },
      transactionId: { type: new GraphQLNonNull(GraphQLString) },
      modules: { type: modulesType, resolve: productResolvers.modules },
    },
  });
  return productType;
}

async function buildModulesType(
  productFileNames: ReadonlyArray<string>,
  readJsonFile: ReadJsonFile,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const tablesPerModule = await getUniqueTableDefinitionsPerModule(productFileNames, readJsonFile);
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tablesPerModule)) {
    const moduleFieldName = toSafeName(n);
    fields[moduleFieldName] = { type: await buildModuleType(moduleFieldName, v, usedTypeNames) };
  }
  const tablesType = new GraphQLObjectType({ name: getUniqueTypeName("Modules", usedTypeNames), fields });
  return tablesType;
}

async function buildModuleType(
  moduleName: string,
  tableDefs: ColumnsPerTable,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableDefs)) {
    const tableFieldName = toSafeName(n);
    fields[tableFieldName] = {
      type: new GraphQLList(await buildTableRowType(tableFieldName, v, usedTypeNames)),
      resolve: (parent: Module) => parent[tableFieldName],
    };
  }
  const moduleType = new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
  return moduleType;
}

function getUniqueTypeName(requestedName: string, usedTypeNames: Set<string>): string {
  if (usedTypeNames.has(requestedName)) {
    return getUniqueTypeName(requestedName + "A", usedTypeNames);
  }
  usedTypeNames.add(requestedName);
  return requestedName;
}

async function buildTableRowType(
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

interface TablesPerModule {
  readonly [module: string]: ColumnsPerTable;
}

interface ColumnsPerTable {
  readonly [tableName: string]: ReadonlyArray<ProductTableFileColumn>;
}

// All tables that have the same structure can be merged...
async function getUniqueTableDefinitionsPerModule(
  productFileNames: ReadonlyArray<string>,
  readJsonFile: ReadJsonFile
): Promise<TablesPerModule> {
  const productFilePromises = productFileNames.map((f) => readJsonFile<ProductFile>(f));
  const productFiles = await Promise.all(productFilePromises);
  const tableFilePromises = productFiles.map((f) => getProductTables(readJsonFile, f));
  const tableFiles = await Promise.all(tableFilePromises);
  const allTableFiles: ReadonlyArray<ProductTableFile> = tableFiles.flat();

  // Group by module
  const tablesPerModule: { [module: string]: { [tableName: string]: ReadonlyArray<ProductTableFileColumn> } } = {};
  for (const t of allTableFiles) {
    let moduleColumnsPerTable = tablesPerModule[t.data.module];
    if (!moduleColumnsPerTable) {
      moduleColumnsPerTable = {};
      tablesPerModule[t.data.module] = moduleColumnsPerTable;
    }
    // TODO: For tables that have the same name but not the same columns, create a generated unique name
    moduleColumnsPerTable[t.data.name] = t.data.columns;
  }

  return tablesPerModule;
}
