import Koa from "koa";
import DataLoader from "dataloader";
import { ProductFile } from "../file-types";

export type GetBaseUrl = (ctx: Koa.Context) => string;

export type ReadJsonFile = <T>(fileName: string) => Promise<T>;

export interface Context {
  readonly getBaseUrl: GetBaseUrl;
  readonly readJsonFile: ReadJsonFile;
  readonly markerFileName: string;
  readonly markerName: string;
  readonly loaders: DataLoaders;
}

export function createContext(
  getBaseUrl: GetBaseUrl,
  readJsonFile: ReadJsonFile,
  markerFileName: string,
  markerName: string
): Context {
  return {
    getBaseUrl,
    markerFileName,
    markerName,
    readJsonFile,
    loaders: createLoaders(readJsonFile),
  };
}

export interface DataLoaders {
  readonly productFiles: DataLoader<string, ProductFile>;
}

export function createLoaders(readJsonFile: ReadJsonFile): DataLoaders {
  return {
    productFiles: new DataLoader(async (filenames: ReadonlyArray<string>) => {
      const promises = filenames.map((f) => readJsonFile<ProductFile>(f));
      const promise = Promise.all(promises);
      return await promise;
    }),
  };
}
