import Koa from "koa";
import {
  RootFile,
  buildRootFileName,
  TreeFile,
  getTypeAndIdentifierFromFileName,
  ReleaseFile,
  parseTransactionFileName,
  ProductFile,
  ProductTableFile,
} from "../file-types";
import { Context, GetFilesDir } from "./context";
import { Marker, Product, Modules } from "./schema-types";
import { readJsonFile, getProducts, getMarkerProductFileNames } from "./read-files";

export type RootValue = {};

export const queryResolvers = {
  trees: async (_parent: RootValue, _args: {}, ctx: Context) => {
    const { getFilesDir, koaCtx } = ctx;
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
    const trees: Array<TreeFile> = [];
    for (const t of Object.keys(rootFileContent.data.trees)) {
      const fileName = rootFileContent.refs[rootFileContent.data.trees[t]];
      trees.push(await treeFileNameToTreeFile(koaCtx, getFilesDir, fileName));
    }
    return trees;
  },
  marker: async (_parent: RootValue, _args: {}, ctx: Context): Promise<Marker> => {
    const { getFilesDir, koaCtx, markerFileName, markerName } = ctx;
    const typeAndId = getTypeAndIdentifierFromFileName(markerFileName);
    if (typeAndId.type === "release") {
      const releaseContent = await readJsonFile<ReleaseFile>(getFilesDir(koaCtx), markerFileName);
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
};

export const markerResolvers = {
  products: async (parent: Marker, _args: {}, ctx: Context) => {
    const { getFilesDir, koaCtx } = ctx;
    // Check if this marker points to a release or a transaction
    const { releaseId, tx } = parent;
    const productFileNames = await getMarkerProductFileNames(koaCtx, getFilesDir, releaseId, tx);
    return getProducts(koaCtx, getFilesDir, productFileNames);
  },
};

export const productResolvers = {
  modules: async (parent: Product, _args: {}, ctx: Context): Promise<Modules> => {
    const { getFilesDir, koaCtx } = ctx;
    const filesDir = getFilesDir(koaCtx);
    const product = await readJsonFile<ProductFile>(filesDir, parent._fileName);
    const tableFileNames = Object.values(product.data.tables).map((v) => product.refs[v]);
    const tablePromises = tableFileNames.map((f) => readJsonFile<ProductTableFile>(filesDir, f));
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

async function treeFileNameToTreeFile(ctx: Koa.Context, getFilesDir: GetFilesDir, fileName: string): Promise<TreeFile> {
  const typeAndId = getTypeAndIdentifierFromFileName(fileName);
  let apiTree: TreeFile;
  if (typeAndId.type === "tree") {
    const treeContent = await readJsonFile<TreeFile>(getFilesDir(ctx), fileName);
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
