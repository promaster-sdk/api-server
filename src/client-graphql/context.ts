import Koa from "koa";

export interface GetFilesDir {
  (ctx: Koa.Context): string;
}

export interface GetBaseUrl {
  (ctx: Koa.Context): string;
}

export interface Context {
  readonly koaCtx: Koa.Context;
  readonly getFilesDir: GetFilesDir;
  readonly getBaseUrl: GetBaseUrl;
  readonly markerFileName: string;
  readonly markerName: string;
}

export function createContext(
  koaCtx: Koa.Context,
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  markerFileName: string,
  markerName: string
): Context {
  return {
    koaCtx,
    getFilesDir,
    getBaseUrl,
    markerFileName,
    markerName,
  };
}
