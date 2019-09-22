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
  // interface MiddlewarePerMarker {
  //   [marker: string]: { markerFileName: string; middleware: Koa.Middleware } | undefined;
  // }
  // const middlewarePerMarker: MiddlewarePerMarker = {};
  const router = new Router({ prefix });

  router.all("/", async (ctx, next) => {
    const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
    const markers = Object.keys(rootFileContent.data.markers).map((m) => m.toLowerCase());
    const urlsToMarkers = markers.map((m) => `${getBaseUrl(ctx)}/${m}`);
    ctx.body = urlsToMarkers;
    return next();
  });

  router.all(
    "/:marker",
    createSchemaMiddleware(getFilesDir),
    createGraphQLMiddleware2(getFilesDir, getBaseUrl)
    // async (ctx, next) => {
    //   const { marker, graphqlSchema } = ctx.params;
    //   console.log("HEJEHEJEHJEHJHE", graphqlSchema);
    //   const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
    //   const markerLowerCase = marker.toLowerCase();
    //   const markerKey = Object.keys(rootFileContent.data.markers).find((m) => m.toLowerCase() === markerLowerCase);
    //   const markerRef = rootFileContent.data.markers[markerKey || ""];
    //   const markerFileName = rootFileContent.refs[markerRef];
    //   if (!markerFileName) {
    //     ctx.body = `Marker ${marker} not found.`;
    //     ctx.status = 404;
    //     return next();
    //   }
    //   let markerMiddleware = middlewarePerMarker[marker];
    //   console.log("markerMiddleware1", markerMiddleware);
    //   if (markerMiddleware) {
    //     // If marker is pointing to new file, then delete old middleware from memory
    //     if (markerMiddleware.markerFileName !== markerFileName) {
    //       delete middlewarePerMarker[marker];
    //       markerMiddleware = undefined;
    //     }
    //   }
    //   console.log("markerMiddleware2", markerMiddleware);
    //   if (!markerMiddleware) {
    //     markerMiddleware = {
    //       markerFileName,
    //       middleware: createGraphQLMiddleware(getFilesDir, getBaseUrl, markerFileName, marker),
    //     };
    //     middlewarePerMarker[marker] = markerMiddleware;
    //   }
    //   console.log("markerMiddleware3", markerMiddleware);
    //   return markerMiddleware.middleware(ctx, next);
    // }
  );

  return compose([router.routes(), router.allowedMethods()]);
}

// This middleware expects ctx.params.marker, and adds a schema for that marker to the context
function createSchemaMiddleware(getFilesDir: GetFilesDir): Koa.Middleware {
  interface SchemaPerMarker {
    [marker: string]: GraphQLSchema;
  }
  const schemaPerMarker: SchemaPerMarker = {};
  return async (ctx, next) => {
    const { marker } = ctx.params;
    const markerFileName = await getMarkerFileName(getFilesDir, ctx, marker);
    if (!markerFileName) {
      ctx.body = `Marker ${marker} not found.`;
      ctx.status = 404;
      return next();
    }
    if (schemaPerMarker[marker] === undefined) {
      console.log("Creating new schema!!!!!");
      schemaPerMarker[marker] = await createSchema(readJsonFile(getFilesDir(ctx)), markerFileName);
    }
    ctx.params.graphqlSchema = schemaPerMarker[marker];
    return next();
  };
}

// function createGraphQLMiddleware(
//   getFilesDir: GetFilesDir,
//   getBaseUrl: GetBaseUrl,
//   markerFileName: string,
//   marker: string
// ): Koa.Middleware {
//   return graphqlHTTP(async (_request, _repsonse, ctx) => ({
//     schema: await createSchema(readJsonFile(getFilesDir(ctx)), markerFileName),
//     graphiql: true,
//     rootValue: {} as RootValue,
//     context: createContext(getBaseUrl, markerFileName, marker, readJsonFile(getFilesDir(ctx))),
//     formatError: (error: GraphQLError) => {
//       console.log("Error occured in GraphQL:");
//       console.log(error);
//       console.log("The original error was:");
//       console.log(error.originalError);
//       return error;
//     },
//   }));
// }

function createGraphQLMiddleware2(getFilesDir: GetFilesDir, getBaseUrl: GetBaseUrl): Koa.Middleware {
  return graphqlHTTP(async (_request, _repsonse, ctx) => ({
    schema: ctx.params.graphqlSchema,
    graphiql: true,
    rootValue: {} as RootValue,
    context: createContext(
      getBaseUrl,
      (await getMarkerFileName(getFilesDir, ctx, ctx.params.marker)) || "",
      ctx.params.marker,
      readJsonFile(getFilesDir(ctx))
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

async function getMarkerFileName(
  getFilesDir: GetFilesDir,
  ctx: Koa.Context,
  marker: string
): Promise<string | undefined> {
  const rootFileContent = await readJsonFile<RootFile>(getFilesDir(ctx))(buildRootFileName());
  const markerLowerCase = marker.toLowerCase();
  const markerKey = Object.keys(rootFileContent.data.markers).find((m) => m.toLowerCase() === markerLowerCase);
  const markerRef = rootFileContent.data.markers[markerKey || ""];
  const markerFileName = rootFileContent.refs[markerRef];
  return markerFileName;
}
