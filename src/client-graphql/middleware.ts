import path from "path";
import fs from "fs";
import { promisify } from "util";
import Koa from "koa";
import Router from "koa-router";
import compose from "koa-compose";
import graphqlHTTP from "koa-graphql";
import { GraphQLError, GraphQLSchema } from "graphql";
import { createSchema } from "./schema";
import { GetBaseUrl, createContext } from "./context";
import { RootValue } from "./resolvers";
import { buildRootFileName, RootFile } from "../file-types";

const readFileAsync = promisify(fs.readFile);

export const readJsonFile = <T>(filesDir: string) => async (fileName: string): Promise<T> => {
  console.log("readJsonFile", fileName);
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
};

export interface GetFilesDir {
  (ctx: Koa.Context): string;
}

export function createClientGraphQLMiddleware(
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  prefix?: string
): Koa.Middleware {
  const router = new Router({ prefix });

  router.all("/", async (ctx, next) => {
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
    const markers = Object.keys(rootFileContent.data.markers).map((m) => m.toLowerCase());
    const urlsToMarkers = markers.map((m) => `${getBaseUrl(ctx)}/${m}`);
    ctx.body = urlsToMarkers;
    return next();
  });

  router.all("/:marker", createSchemaMiddleware(getFilesDir), createGraphQLMiddleware(getFilesDir, getBaseUrl));

  return compose([router.routes(), router.allowedMethods()]);
}

/**
 * This middleware expects ctx.params.marker, and adds a schema for that marker to the context.
 * It will only create the schema once, and recreate it if the marker is pointing to a new file.
 */
function createSchemaMiddleware(getFilesDir: GetFilesDir): Koa.Middleware {
  interface SchemaPerMarker {
    [marker: string]: { readonly markerFileName: string; readonly schema: GraphQLSchema } | undefined;
  }
  const schemaPerMarker: SchemaPerMarker = {};
  return async (ctx, next) => {
    const { marker } = ctx.params;
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
    const markerLowerCase = marker.toLowerCase();
    const markerKey = Object.keys(rootFileContent.data.markers).find((m) => m.toLowerCase() === markerLowerCase);
    const markerRef = rootFileContent.data.markers[markerKey || ""];
    const markerFileName = rootFileContent.refs[markerRef];
    if (!markerFileName) {
      ctx.body = `Marker ${marker} not found.`;
      ctx.status = 404;
      return next();
    }
    let markerSchema = schemaPerMarker[marker];
    if (markerSchema) {
      // If marker is pointing to new file, then delete old schema from memory
      if (markerSchema.markerFileName !== markerFileName) {
        delete schemaPerMarker[marker];
        markerSchema = undefined;
      }
    }
    if (!markerSchema) {
      markerSchema = { markerFileName, schema: await createSchema(readJsonFile(getFilesDir(ctx)), markerFileName) };
      schemaPerMarker[marker] = markerSchema;
    }
    ctx.params.markerFileName = markerSchema.markerFileName;
    ctx.params.graphqlSchema = markerSchema.schema;
    return next();
  };
}

/**
 * This middleware expects ctx.params.marker, ctx.params.markerFileName,
 * ctx.params.graphqlSchema to be set by a previous middleware
 */
function createGraphQLMiddleware(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return graphqlHTTP(async (_request, _repsonse, ctx) => ({
    schema: ctx.params.graphqlSchema,
    graphiql: true,
    rootValue: {} as RootValue,
    context: createContext(getBaseUrl, ctx.params.markerFileName, ctx.params.marker, readJsonFile(getFilesDir(ctx))),
    formatError: (error: GraphQLError) => {
      console.log("Error occured in GraphQL:");
      console.log(error);
      console.log("The original error was:");
      console.log(error.originalError);
      return error;
    },
  }));
}
