import path from "path";
import fs from "fs";
import { promisify } from "util";
import Koa from "koa";
import Router from "koa-router";
import compose from "koa-compose";
import graphqlHTTP from "koa-graphql";
import { GraphQLError } from "graphql";
import { createSchema } from "./schema";
import { GetFilesDir, GetBaseUrl, createContext } from "./context";
import { RootValue } from "./resolvers";
import { buildRootFileName, RootFile } from "../file-types";

const readFileAsync = promisify(fs.readFile);

export const readJsonFile = <T>(filesDir: string) => async (fileName: string): Promise<T> => {
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
};

export function createClientMultiMarkerGraphQLMiddleware(
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
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
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
      markerMiddleware = createGraphQLMiddleware(getFilesDir, getBaseUrl, markerFileName, marker);
      middlewarePerMarker[marker] = markerMiddleware;
    }
    return markerMiddleware(ctx, next);
  });

  return compose([router.routes(), router.allowedMethods()]);
}

function createGraphQLMiddleware(
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  markerFileName: string,
  marker: string
): Koa.Middleware {
  return graphqlHTTP(async (_request, _repsonse, ctx) => ({
    schema: await createSchema(readJsonFile(getFilesDir(ctx)), markerFileName),
    graphiql: true,
    rootValue: {} as RootValue,
    context: createContext(ctx, getFilesDir, getBaseUrl, markerFileName, marker, readJsonFile(getFilesDir(ctx))),
    formatError: (error: GraphQLError) => {
      console.log("Error occured in GraphQL:");
      console.log(error);
      console.log("The original error was:");
      console.log(error.originalError);
      return error;
    },
  }));
}
