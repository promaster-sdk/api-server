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
  GraphQLResolveInfo,
} from "graphql";
import { queryResolvers, productResolvers } from "./resolvers";
import { ProductFile, ProductTableFile, ProductTableFileColumn, ReleaseFile, TransactionFile } from "../file-types";
import { ReadJsonFile } from "./context";
import { getUniqueTypeName, toSafeName } from "./shared-functions";
import { ModulePlugin, TableByName } from "./module-plugin";
import * as DefaultModule from "./modules/default";
import * as PropertiesModule from "./modules/properties";
import * as SoundModule from "./modules/sound";
import * as ModelsModule from "./modules/models";
import * as TextsModule from "./modules/texts";

const defaultModulePlugin: ModulePlugin = DefaultModule;

const modulePlugins: { readonly [name: string]: ModulePlugin } = {
  properties: PropertiesModule,
  sound: SoundModule,
  models: ModelsModule,
  texts: TextsModule,
};

export const defaultResolveModuleType = (parent: string, _args: {}, _ctx: {}, info: GraphQLResolveInfo) => {
  return { module: info.fieldName, productFileName: parent };
};

export async function createSchema(
  readJsonFile: ReadJsonFile,
  releaseOrTransaction: ReleaseFile | TransactionFile
): Promise<GraphQLSchema> {
  const usedTypeNames = new Set<string>();

  // Read the file that the marker points to, it is either a Release or Transaction file
  const productFileNames = Object.values(releaseOrTransaction.data.products).map(
    (ref) => releaseOrTransaction.refs[ref]
  );

  const treeRelationType = new GraphQLObjectType({
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
        type: new GraphQLNonNull(GraphQLList(treeRelationType)),
      },
    },
  });

  const markerType = new GraphQLObjectType({
    name: getUniqueTypeName("Marker", usedTypeNames),
    fields: {
      markerName: { type: new GraphQLNonNull(GraphQLString) },
      releaseId: { type: GraphQLString },
      releaseName: { type: GraphQLString },
      tx: { type: GraphQLString },
    },
  });

  const productType = await buildProductType(readJsonFile, productFileNames, usedTypeNames);

  const queryType = new GraphQLObjectType({
    name: getUniqueTypeName("Query", usedTypeNames),
    fields: {
      trees: {
        type: new GraphQLList(treeType),
        description: "Trees describes relations between products.",
        resolve: queryResolvers.trees,
      },
      marker: {
        type: new GraphQLNonNull(markerType),
        description: "Information about the marker for this enpoint.",
        resolve: queryResolvers.marker,
      },
      products: {
        type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(productType))),
        description: "Gets all products",
        resolve: queryResolvers.products,
      },
      product: {
        type: productType,
        args: { id: { type: new GraphQLNonNull(GraphQLID), description: "The Id of the product to get" } },
        description: "Get a specific product.",
        resolve: queryResolvers.product,
      },
    },
  });

  return new GraphQLSchema({ query: queryType });
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
      id: { type: new GraphQLNonNull(GraphQLID), resolve: productResolvers.id },
      key: { type: new GraphQLNonNull(GraphQLString), resolve: productResolvers.key },
      name: { type: new GraphQLNonNull(GraphQLString), resolve: productResolvers.name },
      retired: { type: new GraphQLNonNull(GraphQLBoolean), resolve: productResolvers.retired },
      modules: modulesType
        ? { type: new GraphQLNonNull(modulesType), resolve: productResolvers.modules }
        : { type: new GraphQLNonNull(GraphQLString), resolve: () => "No tables found." },
    },
  });
  return productType;
}

async function buildModulesType(
  productFileNames: ReadonlyArray<string>,
  readJsonFile: ReadJsonFile,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType | undefined> {
  const tablesPerModule = await getUniqueTableDefinitionsPerModule(productFileNames, readJsonFile);
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [moduleName, tableByName] of Object.entries(tablesPerModule)) {
    // Check if there is a plugin for this module or if it should use generic handling
    const moduleFieldName = toSafeName(moduleName);
    const modulePlugin = modulePlugins[moduleName] || defaultModulePlugin;
    const resolveModuleType = modulePlugin.resolveModuleType || defaultResolveModuleType;
    fields[moduleFieldName] = {
      type: new GraphQLNonNull(await modulePlugin.createModuleType(moduleFieldName, usedTypeNames, tableByName)),
      resolve: resolveModuleType,
    };
  }
  if (Object.keys(fields).length === 0) {
    return undefined;
  }
  const tablesType = new GraphQLObjectType({ name: getUniqueTypeName("Modules", usedTypeNames), fields });
  return tablesType;
}

interface TablesPerModule {
  readonly [module: string]: TableByName;
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
  const tablesPerModule: {
    [module: string]: { [tableName: string]: { description: string; columns: ReadonlyArray<ProductTableFileColumn> } };
  } = {};
  for (const t of allTableFiles) {
    let moduleColumnsPerTable = tablesPerModule[t.data.module];
    if (!moduleColumnsPerTable) {
      moduleColumnsPerTable = {};
      tablesPerModule[t.data.module] = moduleColumnsPerTable;
    }
    // TODO: For tables that have the same name but not the same columns, create a generated unique name
    moduleColumnsPerTable[t.data.name] = { description: t.data.description, columns: t.data.columns };
  }
  return tablesPerModule;
}

async function getProductTables(
  readJsonFile: ReadJsonFile,
  productFile: ProductFile
): Promise<ReadonlyArray<ProductTableFile>> {
  const tableKeys = Object.keys(productFile.data.tables);
  const tableFileNames = tableKeys.map((tableName) => productFile.refs[productFile.data.tables[tableName]]);
  const promises = tableFileNames.map((f) => readJsonFile<ProductTableFile>(f));
  const tableFilesContent: ReadonlyArray<ProductTableFile> = await Promise.all(promises);
  return tableFilesContent;
}
