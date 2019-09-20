import Koa from "koa";

export interface GetBaseUrl {
  (ctx: Koa.Context): string;
}

export type ReadJsonFile = <T>(fileName: string) => Promise<T>;

export interface Context {
  readonly getBaseUrl: GetBaseUrl;
  readonly markerFileName: string;
  readonly markerName: string;
  readonly readJsonFile: ReadJsonFile;
}

export function createContext(
  getBaseUrl: GetBaseUrl,
  markerFileName: string,
  markerName: string,
  readJsonFile: ReadJsonFile
): Context {
  return {
    getBaseUrl,
    markerFileName,
    markerName,
    readJsonFile,
  };
}
