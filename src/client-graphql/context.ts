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
}

export function createContext(koaCtx: Koa.Context, getFilesDir: GetFilesDir): Context {
  return {
    koaCtx,
    getFilesDir,
  };
}
