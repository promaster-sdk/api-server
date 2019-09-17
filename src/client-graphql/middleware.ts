import Koa from "koa";
import Router from "koa-router";
import compose from "koa-compose";
import graphqlHTTP from "koa-graphql";
import { GraphQLError } from "graphql";
import { schema } from "./schema";
import { GetFilesDir, GetBaseUrl, createContext } from "./context";
import { RootValue } from "./resolvers";

export function createClientGraphQLMiddleware(
  getFilesDir: GetFilesDir,
  _getBaseUrl: GetBaseUrl,
  prefix?: string
): Koa.Middleware {
  const router = new Router({ prefix });

  router.all(
    "/",
    graphqlHTTP((_request, _repsonse, ctx) => ({
      schema: schema,
      graphiql: true,
      rootValue: {} as RootValue,
      context: createContext(ctx, getFilesDir),
      formatError: (error: GraphQLError) => {
        console.log("Error occured in GraphQL:");
        console.log(error);
        console.log("The original error was:");
        console.log(error.originalError);
        return error;
      },
    }))
  );

  return compose([router.routes(), router.allowedMethods()]);
}
