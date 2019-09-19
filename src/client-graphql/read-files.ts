import { Product } from "./schema-types";
import {
  ReleaseFile,
  buildReleaseFileName,
  TransactionFile,
  buildTransactionFileName,
  ProductFile,
  ProductTableFile,
} from "../file-types";
import { ReadJsonFile } from "./context";

export async function getMarkerProductFileNames(
  readJsonFile: ReadJsonFile,
  releaseId?: string,
  transactionId?: string
): Promise<ReadonlyArray<string>> {
  if (releaseId) {
    const releaseFile = await readJsonFile<ReleaseFile>(buildReleaseFileName(releaseId));
    return Object.values(releaseFile.data.products).map((ref) => releaseFile.refs[ref]);
  } else if (transactionId) {
    const transactionFile = await readJsonFile<TransactionFile>(buildTransactionFileName(transactionId));
    return Object.values(transactionFile.data.products).map((ref) => transactionFile.refs[ref]);
  } else {
    // This should never happen
    return [];
  }
}

export async function getProducts(
  readJsonFile: ReadJsonFile,
  productFileNames: ReadonlyArray<string>
): Promise<ReadonlyArray<Product>> {
  // Create all products in parallell
  const apiProductPromises = productFileNames.map((f) => getProduct(readJsonFile, f));
  const apiProducts = await Promise.all(apiProductPromises);
  return apiProducts;
}

async function getProduct(readJsonFile: ReadJsonFile, productFileName: string): Promise<Product> {
  const productFile: ProductFile = await readJsonFile<ProductFile>(productFileName);
  return { ...productFile.data, _fileName: productFileName };
}

export function toSafeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export async function getProductTables(
  readJsonFile: ReadJsonFile,
  productFile: ProductFile
): Promise<ReadonlyArray<ProductTableFile>> {
  const tableKeys = Object.keys(productFile.data.tables);
  const tableFileNames = tableKeys.map((tableName) => productFile.refs[productFile.data.tables[tableName]]);
  const promises = tableFileNames.map((f) => readJsonFile<ProductTableFile>(f));
  const tableFilesContent: ReadonlyArray<ProductTableFile> = await Promise.all(promises);
  return tableFilesContent;
}
