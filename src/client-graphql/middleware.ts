import path from "path";
import fs from "fs";
import { promisify } from "util";
import Koa from "koa";
import Router from "@koa/router";
import compose from "koa-compose";
import graphqlHTTP from "koa-graphql";
import { GraphQLError, GraphQLSchema } from "graphql";
import { createSchema } from "./schema";
import { GetBaseUrl, createContext, Context } from "./context";
import { RootValue } from "./resolvers";
import { buildRootFileName, RootFile, ReleaseFile, TransactionFile } from "../file-types";
import { getDatabaseId } from "../context-parsing";
import { withSpan } from "../tracing";

const readFileAsync = promisify(fs.readFile);

export const readJsonFile = <T>(filesDir: string) => async (fileName: string): Promise<T> => {
  return await withSpan("readJsonFile", async (span) => {
    span.setAttribute("fileName", fileName);
    const fullPath = path.join(filesDir, fileName);
    const text = await withSpan("readFileAsync", async () => {
      return await readFileAsync(fullPath, "utf8");
    });
    const content = await withSpan("JSON.parse", async () => {
      return JSON.parse(text);
    });
    return content;
  });
};

export interface GetFilesDir {
  (databaseId: string): string;
}

export function createClientGraphQLMiddleware(
  getFilesDir: GetFilesDir,
  getBaseUrl: GetBaseUrl,
  enableGraphIQL: boolean,
  prefix?: string
): Koa.Middleware {
  const router = new Router({ prefix });
  router.all("/:database_id", createGetMarkersMiddleware(getFilesDir, getBaseUrl));
  router.all("/:database_id/:marker", createSchemaMiddleware(getFilesDir), createGraphQLMiddleware(enableGraphIQL));
  return compose([router.routes(), router.allowedMethods()]);
}

/**
 * This middleware lists all markers and an URL to the GraphQL endpoint for each marker
 */
function createGetMarkersMiddleware(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return async (ctx, next) => {
    const databaseId = getDatabaseId(ctx, false);
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(databaseId))(buildRootFileName());
    const markers = Object.keys(rootFileContent.data.markers).map((m) => m.toLowerCase());
    const urlsToMarkers = markers.map((m) => `${getBaseUrl(ctx, databaseId)}/${m}`);
    ctx.body = urlsToMarkers;
    return next();
  };
}

interface ContextState {
  // tslint:disable-next-line:readonly-keyword
  graphqlSchema: GraphQLSchema;
  // tslint:disable-next-line:readonly-keyword
  graphqlContext: Context;
}

/**
 * This middleware expects ctx.params.marker, and adds a schema and context for that marker to ctx.state.
 * It will cache the created schema until the marker is pointing to a new file.
 */
function createSchemaMiddleware(getFilesDir: GetFilesDir): Koa.Middleware<ContextState> {
  const schemaPerMarker: {
    [marker: string]:
      | {
          readonly markerFileName: string;
          readonly markerFile: ReleaseFile | TransactionFile;
          readonly schema: GraphQLSchema;
        }
      | undefined;
  } = {};
  return async (ctx, next) => {
    const { marker } = ctx.params;
    const rootFile = await readJsonFile<RootFile>(getFilesDir(getDatabaseId(ctx, false)))(buildRootFileName());
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
      const markerFile = await readJsonFile<ReleaseFile | TransactionFile>(getFilesDir(getDatabaseId(ctx, false)))(
        markerFileName
      );
      markerSchema = {
        markerFileName,
        markerFile,
        schema: await createSchema(readJsonFile(getFilesDir(getDatabaseId(ctx, false))), markerFile),
      };
      schemaPerMarker[marker] = markerSchema;
    }
    ctx.state.graphqlSchema = markerSchema.schema;
    ctx.state.graphqlContext = createContext(
      readJsonFile(getFilesDir(getDatabaseId(ctx, false))),
      ctx.params.marker,
      markerSchema.markerFile,
      rootFile
    );
    return next();
  };
}

/**
 * This middleware expects ctx.params.marker, ctx.params.markerFileName,
 * ctx.params.graphqlSchema to be set by a previous middleware
 * and presents an GraphQL endpoint that can be used according to the schema.
 */
function createGraphQLMiddleware(enableGraphIQL: boolean): Koa.Middleware<ContextState> {
  return graphqlHTTP(async (_request, _repsonse, ctx: Koa.ParameterizedContext<ContextState>) => ({
    schema: ctx.state.graphqlSchema,
    context: ctx.state.graphqlContext,
    rootValue: {} as RootValue,
    graphiql: enableGraphIQL,
    formatError: (error: GraphQLError) => {
      console.log("Error occured in GraphQL:");
      console.log(error);
      console.log("The original error was:");
      console.log(error.originalError);
      return error;
    },
  }));
}
