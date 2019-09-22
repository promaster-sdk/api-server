import { TreeFile, ReleaseFile, ProductTableFile, TransactionFile } from "../file-types";
import { Context } from "./context";
import { Query, Marker, Product } from "./schema-types";

export type RootValue = {};

type ProductFileNames = ReadonlyArray<ProductFileName>;
type ProductFileName = string;

type QueryParents = {
  readonly trees: Query["trees"];
  readonly marker: Query["marker"];
  readonly products: ProductFileNames;
  readonly product: ProductFileName | null;
};

export const queryResolvers: {
  [P in keyof Query]?: (parent: RootValue, args: {}, ctx: Context) => Promise<QueryParents[P]>
} = {
  trees: async (_parent: RootValue, _args: {}, ctx: Context) => {
    const { rootFile, readJsonFile } = ctx;
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
      throw new Error("Invalid marker.");
    }
  },
  products: async (_parent, _args: {}, ctx: Context): Promise<ProductFileNames> => {
    const { markerFile } = ctx;
    const productFileNames = Object.values(markerFile.data.products).map((ref) => markerFile.refs[ref]);
    return productFileNames;
  },
  product: async (_parent, { id }: { readonly id: string }, ctx) => {
    const { markerFile } = ctx;
    const productFileRef = markerFile.data.products[id];
    const productFileName = markerFile.refs[productFileRef];
    if (productFileName === undefined) {
      return null;
    }
    return productFileName;
  },
};

export const productResolvers: {
  [P in keyof Product]?: (parent: ProductFileName, args: {}, ctx: Context) => Promise<Product[P]>
} = {
  id: async (parent, _args, ctx) => (await ctx.loaders.productFiles.load(parent)).data.id,
  key: async (parent, _args, ctx) => (await ctx.loaders.productFiles.load(parent)).data.key,
  name: async (parent, _args: {}, ctx) => (await ctx.loaders.productFiles.load(parent)).data.name,
  retired: async (parent, _args: {}, ctx) => (await ctx.loaders.productFiles.load(parent)).data.retired,
  modules: async (parent, _args, ctx) => {
    const { readJsonFile } = ctx;
    const productFile = await ctx.loaders.productFiles.load(parent);
    const tableFileNames = Object.values(productFile.data.tables).map((v) => productFile.refs[v]);
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
