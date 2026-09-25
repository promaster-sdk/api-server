import { createRequire } from "module";
import path from "path";
import Koa from "koa";
import mount from "koa-mount";
import cors from "@koa/cors";
import compose from "koa-compose";
import compress from "koa-compress";
import type * as PrometheusApiMetrics from "prometheus-api-metrics";
import { createPublishApiMiddleware } from "../publish/index.js";
import { createClientRestMiddleware } from "../client-rest/index.js";
import { createClientGraphQLMiddleware } from "../client-graphql/index.js";
import { createVerifyPublishApiMiddleware } from "../verify-publish-api/index.js";
import * as Config from "./config.js";

// startServer(Config.config);

// Loaded with require: source-map-support has no types, and prometheus-api-metrics
// reads module.parent, which is not set when imported from ESM
const requireCjs = createRequire(import.meta.url);
requireCjs("source-map-support").install();
const { koaMiddleware: createMetricsMiddleware } = requireCjs("prometheus-api-metrics") as typeof PrometheusApiMetrics;

export async function startServer(config: Config.Config): Promise<void> {
  console.info("Starting api-server with config:");
  console.info(Config.schema.toString());

  // Basic server config
  const app = new Koa();
  app.proxy = true; // Trust proxy header fields, for example X-Forwarded-Host

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
  const publishApi = createPublishApiMiddleware((databaseId) => path.join(config.filesPath, databaseId), undefined, config.filenamesInParallel, true);
  const verifyPublishApiTokenMiddleware = createVerifyPublishApiMiddleware(
    config.jwksUri,
    (config.publishApiValidClients && config.publishApiValidClients.split(",")) || []
  );
  const publishApiWithToken = compose([verifyPublishApiTokenMiddleware, publishApi]);
  app.use(mount("/publish", publishApiWithToken));

  // Client REST API v3
  const clientApiRestApp = createClientRestMiddleware(
    (databaseId) => path.join(config.filesPath, databaseId),
    (ctx, databaseId) => `${ctx.request.protocol}://${ctx.request.host}/rest/v3/${databaseId}/public`,
    undefined,
    { blobMimeType: config.blobMimeType }
  );
  app.use(mount("/rest/v3", clientApiRestApp));

  // GraphQL API
  const clientApiGraphQLApp = createClientGraphQLMiddleware(
    (databaseId) => path.join(config.filesPath, databaseId),
    (ctx, databaseId) => `${ctx.request.protocol}://${ctx.request.host}/graphql/${databaseId}`,
    config.graphiqlEnable,
    undefined,
    { blobMimeType: config.blobMimeType }
  );
  app.use(mount("/graphql", clientApiGraphQLApp));

  app.use(createMetricsMiddleware()); // Add /metrics endpoint for prometheus

  // Start server
  app.listen(config.port, config.ip);
  console.log(`Server listening at http://${config.ip}:${config.port}`);
}
