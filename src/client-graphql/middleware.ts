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
import { buildRootFileName, RootFile, ReleaseFile, TransactionFile } from "../file-types";

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
  router.all("/", createGetMarkersMiddleware(getFilesDir, getBaseUrl));
  router.all("/:marker", createSchemaMiddleware(getFilesDir), createGraphQLMiddleware(getFilesDir, getBaseUrl));
  return compose([router.routes(), router.allowedMethods()]);
}

/**
 * This middleware lists all markers and an URL to the GraphQL endpoint for each marker
 */
function createGetMarkersMiddleware(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async (ctx, next) => {
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
    const markers = Object.keys(rootFileContent.data.markers).map((m) => m.toLowerCase());
    const urlsToMarkers = markers.map((m) => `${getBaseUrl(ctx)}/${m}`);
    ctx.body = urlsToMarkers;
    return next();
  };
}

interface ContextState {
  readonly rootFile: RootFile;
  // readonly markerFileName: string;
  readonly markerFile: ReleaseFile | TransactionFile;
  readonly graphqlSchema: GraphQLSchema;
}

/**
 * This middleware expects ctx.params.marker, and adds a schema for that marker to ctx.state.
 * It will only create the schema once, and recreate it if the marker is pointing to a new file.
 */
function createSchemaMiddleware(getFilesDir: GetFilesDir): Koa.Middleware<ContextState> {
  interface SchemaPerMarker {
    [marker: string]:
      | {
          readonly markerFileName: string;
          readonly markerFile: ReleaseFile | TransactionFile;
          readonly schema: GraphQLSchema;
        }
      | undefined;
  }
  const schemaPerMarker: SchemaPerMarker = {};
  return async (ctx, next) => {
    const { marker } = ctx.params;
    const rootFile = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
    const markerLowerCase = marker.toLowerCase();
    const markerKey = Object.keys(rootFile.data.markers).find((m) => m.toLowerCase() === markerLowerCase);
    const markerRef = rootFile.data.markers[markerKey || ""];
    const markerFileName = rootFile.refs[markerRef];
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
      const markerFile = await readJsonFile<ReleaseFile | TransactionFile>(getFilesDir(ctx))(markerFileName);
      markerSchema = {
        markerFileName,
        markerFile,
        schema: await createSchema(readJsonFile(getFilesDir(ctx)), markerFile),
      };
      schemaPerMarker[marker] = markerSchema;
    }
    ctx.state = {
      ...ctx.state,
      graphqlSchema: markerSchema.schema,
      rootFile,
      markerFile: markerSchema.markerFile,
    };
    return next();
  };
}

/**
 * This middleware expects ctx.params.marker, ctx.params.markerFileName,
 * ctx.params.graphqlSchema to be set by a previous middleware
 * and presents an GraphQL endpoint that can be used according to the schema.
 */
function createGraphQLMiddleware(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware<ContextState> {
  return graphqlHTTP(async (_request, _repsonse, ctx: Koa.ParameterizedContext<ContextState>) => ({
    schema: ctx.state.graphqlSchema,
    graphiql: true,
    rootValue: {} as RootValue,
    context: createContext(
      getBaseUrl,
      readJsonFile(getFilesDir(ctx)),
      ctx.params.marker,
      ctx.state.markerFile,
      ctx.state.rootFile
    ),
    formatError: (error: GraphQLError) => {
      console.log("Error occured in GraphQL:");
      console.log(error);
      console.log("The original error was:");
      console.log(error.originalError);
      return error;
    },
  }));
}
