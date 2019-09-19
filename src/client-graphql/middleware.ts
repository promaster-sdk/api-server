import Koa from "koa";
import Router from "koa-router";
import compose from "koa-compose";
import graphqlHTTP from "koa-graphql";
import { GraphQLError } from "graphql";
import { createSchema } from "./schema";
import { GetFilesDir, GetBaseUrl, createContext } from "./context";
import { RootValue } from "./resolvers";
import { readJsonFile } from "./read-files";
import { buildRootFileName, RootFile } from "../file-types";

export function createClientGraphQLMiddleware(
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  prefix?: string
): Koa.Middleware {
  const middlewarePerMarker: { [marker: string]: Koa.Middleware } = {};
  const router = new Router({ prefix });

  router.all("/", async (ctx, next) => {
    ctx.body = "No marker specified.";
    ctx.status = 404;
    return next();
  });

  router.all("/:marker", async (ctx, next) => {
    const { marker } = ctx.params;
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx), buildRootFileName());
    const markerRef = rootFileContent.data.markers[marker];
    const markerFileName = rootFileContent.refs[markerRef];
    if (!markerFileName) {
      ctx.body = `Marker ${marker} not found.`;
      ctx.status = 404;
      return next();
    }
    let markerMiddleware = middlewarePerMarker[marker];
    if (!markerMiddleware) {
      console.log("Creating middleware");
      markerMiddleware = graphqlHTTP(async (_request, _repsonse, ctx) => ({
        schema: await createSchema(ctx, getFilesDir, markerFileName),
        graphiql: true,
        rootValue: {} as RootValue,
        context: createContext(ctx, getFilesDir, getBaseUrl, markerFileName, marker),
        formatError: (error: GraphQLError) => {
          console.log("Error occured in GraphQL:");
          console.log(error);
          console.log("The original error was:");
          console.log(error.originalError);
          return error;
        },
      }));
      middlewarePerMarker[marker] = markerMiddleware;
    }
    return markerMiddleware(ctx, next);
  });

  return compose([router.routes(), router.allowedMethods()]);
}
