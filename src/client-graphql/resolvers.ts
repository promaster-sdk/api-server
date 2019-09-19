import {
  RootFile,
  buildRootFileName,
  TreeFile,
  getTypeAndIdentifierFromFileName,
  ReleaseFile,
  parseTransactionFileName,
  ProductFile,
  ProductTableFile,
  TransactionFile,
} from "../file-types";
import { Context, ReadJsonFile } from "./context";
import { Marker, Product, Modules } from "./schema-types";

export type RootValue = {};

export const queryResolvers = {
  trees: async (_parent: RootValue, _args: {}, ctx: Context) => {
    const { readJsonFile } = ctx;
    const rootFileContent = await readJsonFile<RootFile>(buildRootFileName());
    const trees: Array<TreeFile> = [];
    for (const t of Object.keys(rootFileContent.data.trees)) {
      const fileName = rootFileContent.refs[rootFileContent.data.trees[t]];
      const treeContent = await readJsonFile<TreeFile>(fileName);
      trees.push(treeContent);
    }
    return trees;
  },
  marker: async (_parent: RootValue, _args: {}, ctx: Context): Promise<Marker> => {
    const { markerFileName, markerName, readJsonFile } = ctx;
    const typeAndId = getTypeAndIdentifierFromFileName(markerFileName);
    if (typeAndId.type === "release") {
      const releaseContent = await readJsonFile<ReleaseFile>(markerFileName);
      return {
        markerName: markerName,
        releaseName: releaseContent.data.name,
        releaseId: releaseContent.data.id.toUpperCase(),
        _fileName: markerFileName,
      };
    } else if (typeAndId.type === "transaction") {
      const parsed = parseTransactionFileName(markerFileName);
      const tx = parsed.tx;
      return {
        markerName: markerName,
        tx: tx.toString(),
        _fileName: markerFileName,
      };
    } else {
      throw new Error("Invalid file type.");
    }
  },
};

export const markerResolvers = {
  products: async (parent: Marker, _args: {}, ctx: Context) => {
    const { readJsonFile } = ctx;
    const releaseFile = await readJsonFile<ReleaseFile | TransactionFile>(parent._fileName);
    const productFileNames = Object.values(releaseFile.data.products).map((ref) => releaseFile.refs[ref]);
    const apiProductPromises = productFileNames.map((f) => getProduct(readJsonFile, f));
    const apiProducts = await Promise.all(apiProductPromises);
    return apiProducts;
  },
};

export const productResolvers = {
  modules: async (parent: Product, _args: {}, ctx: Context): Promise<Modules> => {
    const { readJsonFile } = ctx;
    const product = await readJsonFile<ProductFile>(parent._fileName);
    const tableFileNames = Object.values(product.data.tables).map((v) => product.refs[v]);
    const tablePromises = tableFileNames.map((f) => readJsonFile<ProductTableFile>(f));
    const tables = await Promise.all(tablePromises);
    // Group tables by module
    const tablesByModule: {
      [module: string]: { [table: string]: Array<{ [column: string]: string | number | null }> };
    } = {};
    for (const t of tables) {
      let moduleWithTables = tablesByModule[t.data.module];
      if (!moduleWithTables) {
        moduleWithTables = {};
        tablesByModule[t.data.module] = moduleWithTables;
      }
      const test1 = t.data.rows.map((values) => Object.fromEntries(t.data.columns.map((c, i) => [c.name, values[i]])));
      moduleWithTables[t.data.name] = test1;
    }
    return tablesByModule;
  },
};

async function getProduct(readJsonFile: ReadJsonFile, productFileName: string): Promise<Product> {
  const productFile: ProductFile = await readJsonFile<ProductFile>(productFileName);
  return { ...productFile.data, _fileName: productFileName };
}
