import Koa from "koa";
import { RootFile, buildRootFileName, TreeFile, getTypeAndIdentifierFromFileName } from "../file-types";
import { Context, GetFilesDir } from "./context";
import { Marker } from "./schema-types";
import {
  readJsonFile,
  getMarkerForReleaseOrTransactionFileName,
  toSafeName,
  getProducts,
  getMarkerProductFileNames,
} from "./read-files";

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
  // markers: async (_parent: RootValue, _args: {}, ctx: Context) => {
  //   const { getFilesDir, koaCtx } = ctx;
  //   const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
  //   const apiMarkers: Array<Marker> = [];
  //   for (const m of Object.keys(rootFileContent.data.markers)) {
  //     const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
  //     apiMarkers.push(await markerFileNameToApiMarker(koaCtx, getFilesDir, m, fileName));
  //   }
  //   return apiMarkers;
  // },
};

export async function markersResolver(
  _parent: RootValue,
  _args: {},
  ctx: Context
): Promise<{ readonly [markerName: string]: unknown }> {
  const { getFilesDir, koaCtx } = ctx;
  const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
  const markers: { [markerName: string]: unknown } = {};
  for (const m of Object.keys(rootFileContent.data.markers)) {
    const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
    const marker = await getMarkerForReleaseOrTransactionFileName(koaCtx, getFilesDir, m, fileName);
    const safeMarkerName = toSafeName(marker.markerName);
    markers[safeMarkerName] = marker;
  }
  return markers;
}

export const markerResolvers = {
  products: async (parent: Marker, _args: {}, ctx: Context) => {
    const { getFilesDir, koaCtx } = ctx;
    // Check if this marker points to a release or a transaction
    const { releaseId, transactionId } = parent;
    const productFileNames = await getMarkerProductFileNames(koaCtx, getFilesDir, releaseId, transactionId);
    return getProducts(koaCtx, getFilesDir, productFileNames);
  },
};

export const productResolvers = {
  tables: async (_parent: Marker, _args: {}, _ctx: Context) => {
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
