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

type ProductFileNames = ReadonlyArray<string>;

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
      };
    } else if (typeAndId.type === "transaction") {
      const parsed = parseTransactionFileName(markerFileName);
      const tx = parsed.tx;
      return {
        markerName: markerName,
        tx: tx.toString(),
      };
    } else {
      throw new Error("Invalid file type.");
    }
  },
  products: async (_parent: RootValue, _args: {}, ctx: Context): Promise<ProductFileNames> => {
    const { readJsonFile, markerFileName } = ctx;
    const markerFile = await readJsonFile<ReleaseFile | TransactionFile>(markerFileName);
    const productFileNames = Object.values(markerFile.data.products).map((ref) => markerFile.refs[ref]);
    return productFileNames;
    // const productPromises = productFileNames.map((f) => getProduct(readJsonFile, f));
    // const products = await Promise.all(productPromises);
    // return products;
  },
  product: async (_parent: RootValue, { id }: { readonly id: string }, ctx: Context) => {
    const { readJsonFile, markerFileName } = ctx;
    const releaseFile = await readJsonFile<ReleaseFile | TransactionFile>(markerFileName);
    const productFileRef = releaseFile.data.products[id];
    if (productFileRef === undefined) {
      return null;
    }
    const productFile = releaseFile.refs[productFileRef];
    if (productFile === undefined) {
      return null;
    }
    const product = await getProduct(readJsonFile, productFile);
    return product;
  },
};

// tslint:disable-next-line:no-any
export const productResolvers: { [P in keyof Product]?: any } = {
  id: async (_parent: Product, _args: {}, _ctx: Context): Promise<string> => {
    return "hehe";
  },
  key: async (_parent: Product, _args: {}, _ctx: Context): Promise<string> => {
    return "hehe";
  },
  name: async (_parent: Product, _args: {}, _ctx: Context): Promise<string> => {
    return "hehe";
  },
  retired: async (_parent: Product, _args: {}, _ctx: Context): Promise<string> => {
    return "hehe";
  },
  _fileName: async (_parent: Product, _args: {}, _ctx: Context): Promise<string> => {
    return "hehe";
  },
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
      const rows = t.data.rows.map((values) => Object.fromEntries(t.data.columns.map((c, i) => [c.name, values[i]])));
      moduleWithTables[t.data.name] = rows;
    }
    return tablesByModule;
  },
};

async function getProduct(readJsonFile: ReadJsonFile, productFileName: string): Promise<Product> {
  const productFile: ProductFile = await readJsonFile<ProductFile>(productFileName);
  return { ...productFile.data, _fileName: productFileName, modules: {} };
}
