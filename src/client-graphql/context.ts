import Koa from "koa";
import DataLoader from "dataloader";
import { ProductFile, ReleaseFile, TransactionFile, RootFile, ProductTableFile } from "../file-types";

export type GetBaseUrl = (ctx: Koa.Context, databaseId: string) => string;

export type ReadJsonFile = <T>(fileName: string) => Promise<T>;

export interface Context {
  readonly readJsonFile: ReadJsonFile;
  readonly markerFile: ReleaseFile | TransactionFile;
  readonly markerName: string;
  readonly loaders: DataLoaders;
  readonly rootFile: RootFile;
}

export function createContext(
  readJsonFile: ReadJsonFile,
  markerName: string,
  markerFile: ReleaseFile | TransactionFile,
  rootFile: RootFile
): Context {
  return {
    markerFile,
    rootFile,
    markerName,
    readJsonFile,
    loaders: createLoaders(readJsonFile),
  };
}

export interface DataLoaders {
  readonly productFiles: DataLoader<string, ProductFile>;
  readonly tableFiles: DataLoader<string, ProductTableFile>;
}

export function createLoaders(readJsonFile: ReadJsonFile): DataLoaders {
  return {
    productFiles: new DataLoader(async (filenames: ReadonlyArray<string>) => {
      const promises = filenames.map((f) => readJsonFile<ProductFile>(f));
      const promise = Promise.all(promises);
      return await promise;
    }),
    tableFiles: new DataLoader(async (filenames: ReadonlyArray<string>) => {
      const promises = filenames.map((f) => readJsonFile<ProductTableFile>(f));
      const promise = Promise.all(promises);
      return await promise;
    }),
  };
}
