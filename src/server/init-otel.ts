import * as opentelemetry from "@opentelemetry/sdk-node";
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector-grpc";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
// import { KoaInstrumentation } from "@opentelemetry/koa-instrumentation";
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql";

export async function initOtel() {
  const jaegerExporter = new CollectorTraceExporter();
  const collectorTraceExporter = new PrometheusExporter();

  const sdk = new opentelemetry.NodeSDK({
    traceExporter: jaegerExporter,
    metricExporter: collectorTraceExporter,
    // be sure to disable old plugins (seems we should use "Instrumentation" instead of "Plugin" )
    plugins: {
      http: { enabled: false, path: "@opentelemetry/plugin-http" },
      https: { enabled: false, path: "@opentelemetry/plugin-https" },
      // koa: { enabled: false },
      grpc: { enabled: false },
      koa: { enabled: true, path: "@opentelemetry/koa-instrumentation" },
    },
  });

  const httpInstrumentation = new HttpInstrumentation();
  httpInstrumentation.enable();

  const graphQLInstrumentation = new GraphQLInstrumentation();
  graphQLInstrumentation.enable();

  await sdk.start();

  // You can also use the shutdown method to gracefully shut down the SDK before process shutdown
  // or on some operating system signal.
  const process = require("process");
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(
        () => console.log("SDK shut down successfully"),
        (err) => console.log("Error shutting down SDK", err)
      )
      .finally(() => process.exit(0));
  });
}
