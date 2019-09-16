import Koa from "koa";
import Router from "koa-router";
import compose from "koa-compose";
import graphqlHTTP from "koa-graphql";
import { schema } from "./schema";

export interface GetFilesDir {
  (ctx: Koa.Context): string;
}

export interface GetBaseUrl {
  (ctx: Koa.Context): string;
}

export function createClientGraphQLMiddleware(
  _getFilesDir: GetFilesDir,
  _getBaseUrl: GetBaseUrl,
  prefix?: string
): Koa.Middleware {
  const router = new Router({ prefix });

  router.all(
    "/",
    graphqlHTTP({
      schema: schema,
      graphiql: true,
    })
  );

  return compose([router.routes(), router.allowedMethods()]);
}
