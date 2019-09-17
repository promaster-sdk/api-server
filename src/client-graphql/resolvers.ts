import Koa from "koa";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import {
  RootFile,
  buildRootFileName,
  TreeFile,
  getTypeAndIdentifierFromFileName,
  ReleaseFile,
  parseTransactionFileName,
} from "../file-types";
import { Context, GetFilesDir, GetBaseUrl } from "./context";
import { Marker } from "./schema-types";

export type RootValue = {};

const readFileAsync = promisify(fs.readFile);

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
  markers: async (_parent: RootValue, _args: {}, ctx: Context) => {
    const { getFilesDir, getBaseUrl, koaCtx } = ctx;
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
    const apiMarkers: Array<Marker> = [];
    for (const m of Object.keys(rootFileContent.data.markers)) {
      const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
      apiMarkers.push(await markerFileNameToApiMarker(koaCtx, getFilesDir, getBaseUrl, m, fileName));
    }
    return apiMarkers;
  },
};

export const markerResolvers = {
  products: async (_parent: RootValue, _args: {}, _ctx: Context) => {
    return [];
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

async function markerFileNameToApiMarker(
  ctx: Koa.Context,
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  markerName: string,
  fileName: string
): Promise<Marker> {
  const typeAndId = getTypeAndIdentifierFromFileName(fileName);
  let urlToProducts = "";
  let apiMarker: Marker;
  if (typeAndId.type === "release") {
    const releaseContent = await readJsonFile<ReleaseFile>(getFilesDir(ctx), fileName);
    urlToProducts = `${getBaseUrl(ctx)}/releases/${typeAndId.identifier}`;
    apiMarker = {
      markerName: markerName,
      releaseName: releaseContent.data.name,
      releaseId: releaseContent.data.id.toUpperCase(),
      products: urlToProducts,
    };
  } else if (typeAndId.type === "transaction") {
    const parsed = parseTransactionFileName(fileName);
    const tx = parsed.tx;
    urlToProducts = `${getBaseUrl(ctx)}/transactions/${tx}`;
    apiMarker = {
      markerName: markerName,
      transactionId: tx.toString(),
      products: urlToProducts,
    };
  } else {
    throw new Error("Invalid file type.");
  }
  return apiMarker;
}

async function readJsonFile<T>(filesDir: string, fileName: string): Promise<T> {
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
}
