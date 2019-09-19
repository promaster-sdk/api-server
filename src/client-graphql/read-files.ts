import path from "path";
import fs from "fs";
import { promisify } from "util";
import Koa from "koa";
import { GetFilesDir } from "./context";
import { Marker, Product } from "./schema-types";
import {
  getTypeAndIdentifierFromFileName,
  ReleaseFile,
  parseTransactionFileName,
  buildReleaseFileName,
  TransactionFile,
  buildTransactionFileName,
  ProductFile,
  ProductTableFile,
} from "../file-types";

const readFileAsync = promisify(fs.readFile);

export async function readJsonFile<T>(filesDir: string, fileName: string): Promise<T> {
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
}

export async function getMarkerForReleaseOrTransactionFileName(
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
      tx: tx.toString(),
    };
  } else {
    throw new Error("Invalid file type.");
  }
}

export async function getMarkerProductFileNames(
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir,
  releaseId?: string,
  transactionId?: string
): Promise<ReadonlyArray<string>> {
  if (releaseId) {
    const releaseFile = await readJsonFile<ReleaseFile>(getFilesDir(koaCtx), buildReleaseFileName(releaseId));
    return Object.values(releaseFile.data.products).map((ref) => releaseFile.refs[ref]);
  } else if (transactionId) {
    const transactionFile = await readJsonFile<TransactionFile>(
      getFilesDir(koaCtx),
      buildTransactionFileName(transactionId)
    );
    return Object.values(transactionFile.data.products).map((ref) => transactionFile.refs[ref]);
  } else {
    // This should never happen
    return [];
  }
}

export async function getProducts(
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
  const productFile: ProductFile = await readJsonFile<ProductFile>(getFilesDir(ctx), productFileName);
  return { ...productFile.data, _fileName: productFileName };
}

export function toSafeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

// export async function getTables(
//   koaCtx: Koa.Context,
//   getFilesDir: GetFilesDir,
//   productFiles: ReadonlyArray<ProductFile>
// ): Promise<ReadonlyArray<ReadonlyArray<ProductTableFile>>> {
//   const promises = productFiles.map((f) => getProductTables(getFilesDir(koaCtx), f));
//   const tables = await Promise.all(promises);
//   return tables;
// }

export async function getProductTables(
  filesDir: string,
  productFile: ProductFile
): Promise<ReadonlyArray<ProductTableFile>> {
  const tableKeys = Object.keys(productFile.data.tables);
  const tableFileNames = tableKeys.map((tableName) => productFile.refs[productFile.data.tables[tableName]]);
  const promises = tableFileNames.map((f) => readJsonFile<ProductTableFile>(filesDir, f));
  const tableFilesContent: ReadonlyArray<ProductTableFile> = await Promise.all(promises);
  return tableFilesContent;
}

// function buildFullTableName(tableFile: ProductTableFile): string {
//   return `${tableFile.data.module}@${tableFile.data.name}`;
// }
