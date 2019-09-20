import Koa from "koa";
import mount from "koa-mount";
import cors from "@koa/cors";
import compose from "koa-compose";
import compress from "koa-compress";
import * as Config from "./config";
import { createPublishApiMiddleware } from "../publish";
import { createClientRestMiddleware } from "../client-rest";
import { createClientGraphQLMiddleware } from "../client-graphql";

// tslint:disable-next-line:no-var-requires no-require-imports
require("source-map-support").install();

async function startServer(config: Config.Config): Promise<void> {
  console.info("Starting api-server with config:");
  console.info(Config.schema.toString());

  // Basic server config
  const app = new Koa();
  app.proxy = true; // Trust proxy header fields, for example X-Forwarded-Host
  app.use(cors()); // Allow all cors
  app.use(compress()); // Use compression

  // Publish API
  const publishApi = createPublishApiMiddleware(() => config.filesPath);
  const verifyPublishApiTokenMiddleware = createVerifyApiTokenMiddleware(config.publishAuthorization);
  const publishApiWithToken = compose([verifyPublishApiTokenMiddleware, publishApi]);
  app.use(mount("/publish", publishApiWithToken));

  // Client REST API v3
  const baseUrlRest = `http://${config.ip}:${config.port}/rest/v3`;
  const clientApiRestApp = createClientRestMiddleware(() => config.filesPath, () => baseUrlRest);
  app.use(mount("/rest/v3", clientApiRestApp));

  // GraphQL API
  const baseUrlGraphQL = `http://${config.ip}:${config.port}/graphql`;
  const clientApiGraphQLApp = createClientGraphQLMiddleware(() => config.filesPath, () => baseUrlGraphQL);
  app.use(mount("/graphql", clientApiGraphQLApp));

  // Start server
  app.listen(config.port, config.ip);
  console.log(`Server listening at http://${config.ip}:${config.port}`);
}

function createVerifyApiTokenMiddleware(publishAuthorization: string): Koa.Middleware {
  return (ctx, next) => {
    const authorizationValue = ctx.get("authorization");
    if (authorizationValue !== publishAuthorization) {
      console.warn("publishAuthorization failed");
      ctx.status = 403;
      return;
    } else {
      return next();
    }
  };
}

startServer(Config.config);
