import { SimpleSpanProcessor } from "@opentelemetry/tracing";
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector-grpc";
import { NodeTracerProvider } from "@opentelemetry/node";
import { CollectorExporterConfigNode } from "@opentelemetry/exporter-collector-grpc/build/src/types";
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql";
import { Resource } from "@opentelemetry/resources";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
  LogLevel,
} from "@opentelemetry/core";
import { Config } from "./config";

export function initOtel(serviceName: string, config: Config): void {
  const sampler = getSamplerFromConfig(config.otelTracesSampler);

  // Create and configure NodeTracerProvider
  const provider = new NodeTracerProvider({
    sampler,
    logLevel: getLogLevelFromConfig(config.otelLogLevel),
    // logger: new NoopLogger(),
    resource: new Resource({ "service.name": serviceName }),
  });

  const graphQLInstrumentation = new GraphQLInstrumentation({
    // optional params
    // allowAttributes: true,
    // depth: 2,
    // mergeItems: true,
  });

  graphQLInstrumentation.setTracerProvider(provider); // optional; uses global tracer by default

  graphQLInstrumentation.enable();

  // Add OTEL grpc exporter
  const collectorOptions: CollectorExporterConfigNode = {
    url: "localhost:4317", // url is optional and can be omitted - default is localhost:4317,
  };
  const exporter = new CollectorTraceExporter(collectorOptions);
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  // Initialize the provider
  provider.register();
}

// Helper function that shuold be removed when the OTEL SDK has support for ENV config
// https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md#general-sdk-configuration
function getSamplerFromConfig(value: string) {
  switch (value) {
    case "always_on":
      return new AlwaysOnSampler();
    case "always_off":
      return new AlwaysOffSampler();
    case "traceidratio":
      return new TraceIdRatioBasedSampler();
    case "parentbased_always_on":
      return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    case "parentbased_always_off":
      return new ParentBasedSampler({ root: new AlwaysOffSampler() });
    case "parentbased_traceidratio":
      return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler() });
    default:
      return new AlwaysOffSampler();
  }
}

function getLogLevelFromConfig(value: string): LogLevel {
  const level = parseInt(value);
  if (Number.isFinite(level)) {
    return level;
  }
  switch (value.toUpperCase()) {
    case "ERROR":
      return LogLevel.ERROR;
    case "WARN":
      return LogLevel.WARN;
    case "INFO":
      return LogLevel.INFO;
    case "DEBUG":
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
}
