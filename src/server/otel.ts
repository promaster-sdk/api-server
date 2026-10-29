// api
import api, { DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
// SDK
import * as opentelemetry from "@opentelemetry/sdk-node";
// Exporter
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
// Resources
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
// Instrumentations
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

function logLevelFromEnv(): DiagLogLevel {
  const name = (process.env.OTEL_LOG_LEVEL ?? "INFO").toUpperCase();
  return DiagLogLevel[name as keyof typeof DiagLogLevel] ?? DiagLogLevel.INFO;
}

export async function initOtel(): Promise<void> {
  // https://github.com/open-telemetry/opentelemetry-js/discussions/2633
  // https://github.com/open-telemetry/opentelemetry-js-api/issues/102
  // Logger for otel diagnose (if the issue above is solved this is not needed)
  api.diag.setLogger(new DiagConsoleLogger(), logLevelFromEnv());

  // Create otel collector exporter
  const collectorOptions = {
    // url is optional and can be omitted - default is grpc://localhost:4317
    // url: 'grpc://<collector-hostname>:<port>',
  };
  const exporter = new OTLPTraceExporter(collectorOptions);

  // configure the SDK to export telemetry data to otel collector
  // enable only select intrumentations
  const sdk = new opentelemetry.NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "promaster-api",
    }),
    traceExporter: exporter,
    instrumentations: getNodeAutoInstrumentations(),
  });

  // initialize the SDK and register with the OpenTelemetry API
  // this enables the API to record telemetry
  try {
    sdk.start();
    console.info("otel", "Tracing initialized");
  } catch (error: unknown) {
    console.error("otel", `Error initializing tracing: ${error}`);
  }

  // gracefully shut down the SDK on process exit
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.info("otel", "Tracing terminated"))
      .catch((error: unknown) => console.error("otel", `Error terminating tracing: ${error}`))
      .finally(() => process.exit(0));
  });
}
