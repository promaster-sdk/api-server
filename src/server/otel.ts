// api
import api, { DiagConsoleLogger } from "@opentelemetry/api";
// SDK
import * as opentelemetry from "@opentelemetry/sdk-node";
// Exporter
import { OTLPTraceExporter } from "@opentelemetry/exporter-otlp-grpc";
// Resources
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
// Instrumentations
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

import { getEnv } from "@opentelemetry/core";

export async function initOtel(): Promise<void> {
  // https://github.com/open-telemetry/opentelemetry-js/discussions/2633
  // https://github.com/open-telemetry/opentelemetry-js-api/issues/102
  // Logger for otel diagnose (if the issue above is solved this is not needed)
  api.diag.setLogger(new DiagConsoleLogger(), getEnv().OTEL_LOG_LEVEL);

  // Create otel collector exporter
  const collectorOptions = {
    // url is optional and can be omitted - default is grpc://localhost:4317
    // url: 'grpc://<collector-hostname>:<port>',
  };
  const exporter = new OTLPTraceExporter(collectorOptions);

  // configure the SDK to export telemetry data to otel collector
  // enable only select intrumentations
  const sdk = new opentelemetry.NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "promaster-api",
    }),
    traceExporter: exporter,
    instrumentations: getNodeAutoInstrumentations(),
  });

  // initialize the SDK and register with the OpenTelemetry API
  // this enables the API to record telemetry
  const startPromise = sdk
    .start()
    .then(() => console.info("otel", "Tracing initialized"))
    .catch((error: unknown) => console.error("otel", `Error initializing tracing: ${error}`));

  // gracefully shut down the SDK on process exit
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.info("otel", "Tracing terminated"))
      .catch((error: unknown) => console.error("otel", `Error terminating tracing: ${error}`))
      .finally(() => process.exit(0));
  });

  // Return promise so the caller can await becuase
  // before this promise completes, span recording will not work
  return startPromise;
}
