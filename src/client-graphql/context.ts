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
}

export function createContext(koaCtx: Koa.Context, getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Context {
  return {
    koaCtx,
    getFilesDir,
    getBaseUrl,
  };
}
