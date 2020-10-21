import path from "path";
import Koa from "koa";
import mount from "koa-mount";
import cors from "@koa/cors";
import compose from "koa-compose";
import compress from "koa-compress";
import { koaMiddleware as createMetricsMiddleware } from "prometheus-api-metrics";
import * as Config from "./config";
import { createPublishApiMiddleware } from "../publish";
import { createClientRestMiddleware } from "../client-rest";
import { createClientGraphQLMiddleware } from "../client-graphql";
import { createVerifyPublishApiMiddleware } from "../verify-publish-api";

// tslint:disable-next-line:no-var-requires no-require-imports
require("source-map-support").install();

async function startServer(config: Config.Config): Promise<void> {
  console.info("Starting api-server with config:");
  console.info(Config.schema.toString());

  // Basic server config
  const app = new Koa();
  app.proxy = true; // Trust proxy header fields, for example X-Forwarded-Host
  app.use(createMetricsMiddleware()); // Add /metrics endpoint for prometheus

  app.use(cors()); // Allow all cors
  app.use(compress()); // Use compression

  // x-response-time
  app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.get("X-Response-Time");
    console.log(`${ctx.request.ip} ${ctx.method} ${ctx.url} - ${rt}`);
  });
  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set("X-Response-Time", `${ms}ms`);
  });

  // Publish API
  const publishApi = createPublishApiMiddleware((databaseId) => path.join(config.filesPath, databaseId));
  const verifyPublishApiTokenMiddleware = createVerifyPublishApiMiddleware(
    config.jwksUri,
    (config.publishApiValidClients && config.publishApiValidClients.split(",")) || []
  );
  const publishApiWithToken = compose([verifyPublishApiTokenMiddleware, publishApi]);
  app.use(mount("/publish", publishApiWithToken));

  // Client REST API v3
  const clientApiRestApp = createClientRestMiddleware(
    (databaseId) => path.join(config.filesPath, databaseId),
    (ctx, databaseId) => `${ctx.request.protocol}://${ctx.request.host}/rest/v3/${databaseId}/public`
  );
  app.use(mount("/rest/v3", clientApiRestApp));

  // GraphQL API
  const clientApiGraphQLApp = createClientGraphQLMiddleware(
    (databaseId) => path.join(config.filesPath, databaseId),
    (ctx, databaseId) => `${ctx.request.protocol}://${ctx.request.host}/graphql/${databaseId}`
  );
  app.use(mount("/graphql", clientApiGraphQLApp));

  // Start server
  app.listen(config.port, config.ip);
  console.log(`Server listening at http://${config.ip}:${config.port}`);
}

startServer(Config.config);
