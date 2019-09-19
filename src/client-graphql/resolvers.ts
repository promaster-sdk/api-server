import Koa from "koa";
import {
  RootFile,
  buildRootFileName,
  TreeFile,
  getTypeAndIdentifierFromFileName,
  ReleaseFile,
  parseTransactionFileName,
} from "../file-types";
import { Context, GetFilesDir } from "./context";
import { Marker } from "./schema-types";
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
  modules: async (_parent: Marker, _args: {}, _ctx: Context) => {
    return {
      table1: "olle",
      table2: "kalle",
    };
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
