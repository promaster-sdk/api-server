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
  buildReleaseFileName,
  ProductFile,
  parseProductFileName,
  parseTransactionFileName,
  TransactionFile,
  buildTransactionFileName,
} from "../file-types";
import { Context, GetFilesDir } from "./context";
import { Marker, Product } from "./schema-types";

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
    const { getFilesDir, koaCtx } = ctx;
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(koaCtx), buildRootFileName());
    const apiMarkers: Array<Marker> = [];
    for (const m of Object.keys(rootFileContent.data.markers)) {
      const fileName = rootFileContent.refs[rootFileContent.data.markers[m]];
      apiMarkers.push(await markerFileNameToApiMarker(koaCtx, getFilesDir, m, fileName));
    }
    return apiMarkers;
  },
};

export const markerResolvers = {
  products: async (parent: Marker, _args: {}, ctx: Context) => {
    const { getFilesDir, koaCtx } = ctx;
    // Check if this marker points to a release or a transaction
    if (parent.releaseId) {
      const releaseId: string = parent.releaseId;
      const releaseFile = await readJsonFile<ReleaseFile>(getFilesDir(koaCtx), buildReleaseFileName(releaseId));
      // Fetch all product file names for the release
      const productFileNames = Object.values(releaseFile.data.products).map((ref) => releaseFile.refs[ref]);
      const apiProducts = await getApiProductsForFileNames(koaCtx, getFilesDir, productFileNames);
      return apiProducts;
    } else if (parent.transactionId) {
      const tx: string = parent.transactionId;
      // Read the transaction file
      const transactionFile = await readJsonFile<TransactionFile>(getFilesDir(koaCtx), buildTransactionFileName(tx));
      // Fetch all product file names for the release
      const productFileNames = Object.values(transactionFile.data.products).map((ref) => transactionFile.refs[ref]);
      const apiProducts = await getApiProductsForFileNames(koaCtx, getFilesDir, productFileNames);
      return apiProducts;
    } else {
      return [];
    }
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
  markerName: string,
  fileName: string
): Promise<Marker> {
  const typeAndId = getTypeAndIdentifierFromFileName(fileName);
  if (typeAndId.type === "release") {
    const releaseContent = await readJsonFile<ReleaseFile>(getFilesDir(ctx), fileName);
    return {
      markerName: markerName,
      releaseName: releaseContent.data.name,
      releaseId: releaseContent.data.id.toUpperCase(),
    };
  } else if (typeAndId.type === "transaction") {
    const parsed = parseTransactionFileName(fileName);
    const tx = parsed.tx;
    return {
      markerName: markerName,
      transactionId: tx.toString(),
    };
  } else {
    throw new Error("Invalid file type.");
  }
}

async function readJsonFile<T>(filesDir: string, fileName: string): Promise<T> {
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
}

async function getApiProductsForFileNames(
  ctx: Koa.Context,
  getFilesDir: GetFilesDir,
  productFileNames: ReadonlyArray<string>
): Promise<ReadonlyArray<Product>> {
  // Create all products in parallell
  const apiProductPromises = productFileNames.map((f) => getProduct(ctx, getFilesDir, f));
  const apiProducts = await Promise.all(apiProductPromises);
  return apiProducts;
}

async function getProduct(ctx: Koa.Context, getFilesDir: GetFilesDir, productFileName: string): Promise<Product> {
  // Read the product file
  const productFile: ProductFile = await readJsonFile<ProductFile>(getFilesDir(ctx), productFileName);

  // Build the ApiProduct object
  const parsed = parseProductFileName(productFileName);
  const p: Product = {
    id: productFile.data.id.toLowerCase(),
    key: productFile.data.key,
    name: productFile.data.name,
    retired: productFile.data.retired,
    transactionId: parsed.tx,
  };
  return p;
}
