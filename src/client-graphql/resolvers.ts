import { TreeFile, ReleaseFile, ProductFile, ProductTableFile, TransactionFile } from "../file-types";
import { Context, ReadJsonFile } from "./context";
import { Marker, Product, Modules } from "./schema-types";

export type RootValue = {};

type ProductFileNames = ReadonlyArray<ProductFileName>;
type ProductFileName = string;

export const queryResolvers = {
  trees: async (_parent: RootValue, _args: {}, ctx: Context) => {
    const { rootFile, readJsonFile } = ctx;
    // const rootFile = await readJsonFile<RootFile>(buildRootFileName());
    const trees: Array<TreeFile> = [];
    for (const t of Object.keys(rootFile.data.trees)) {
      const fileName = rootFile.refs[rootFile.data.trees[t]];
      const treeContent = await readJsonFile<TreeFile>(fileName);
      trees.push(treeContent);
    }
    return trees;
  },
  marker: async (_parent: RootValue, _args: {}, ctx: Context): Promise<Marker> => {
    const { markerFile, markerName } = ctx;
    if ((markerFile as ReleaseFile).data.name) {
      const releaseFile = markerFile as ReleaseFile;
      return {
        markerName: markerName,
        releaseName: releaseFile.data.name,
        releaseId: releaseFile.data.id.toUpperCase(),
      };
    } else if ((markerFile as TransactionFile).data.tx) {
      const transactionFile = markerFile as TransactionFile;
      return {
        markerName: markerName,
        tx: transactionFile.data.tx.toString(),
      };
    } else {
      throw new Error("Invalid file type.");
    }
  },
  products: async (_parent: RootValue, _args: {}, ctx: Context): Promise<ProductFileNames> => {
    const { markerFile } = ctx;
    const productFileNames = Object.values(markerFile.data.products).map((ref) => markerFile.refs[ref]);
    return productFileNames;
  },
  product: async (_parent: RootValue, { id }: { readonly id: string }, ctx: Context) => {
    const { readJsonFile, markerFile } = ctx;
    const productFileRef = markerFile.data.products[id];
    if (productFileRef === undefined) {
      return null;
    }
    const productFile = markerFile.refs[productFileRef];
    if (productFile === undefined) {
      return null;
    }
    const product = await getProduct(readJsonFile, productFile);
    return product;
  },
};

// tslint:disable-next-line:no-any
export const productResolvers: { [P in keyof Product]?: any } = {
  id: async (parent: ProductFileName, _args: {}, ctx: Context): Promise<string> => {
    const productFile = await ctx.loaders.productFiles.load(parent);
    return productFile.data.id;
  },
  key: async (parent: ProductFileName, _args: {}, ctx: Context): Promise<string> => {
    const productFile = await ctx.loaders.productFiles.load(parent);
    return productFile.data.key;
  },
  name: async (parent: ProductFileName, _args: {}, ctx: Context): Promise<string> => {
    const productFile = await ctx.loaders.productFiles.load(parent);
    return productFile.data.name;
  },
  retired: async (parent: ProductFileName, _args: {}, ctx: Context): Promise<boolean> => {
    const productFile = await ctx.loaders.productFiles.load(parent);
    return productFile.data.retired;
  },
  _fileName: async (parent: ProductFileName, _args: {}, _ctx: Context): Promise<string> => {
    return parent;
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
