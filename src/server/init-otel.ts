import { SimpleSpanProcessor } from "@opentelemetry/tracing";
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector-grpc";
import { NodeTracerProvider } from "@opentelemetry/node";
import { CollectorExporterConfigNode } from "@opentelemetry/exporter-collector-grpc/build/src/types";
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql";
import { Resource } from "@opentelemetry/resources";

export function initOtel(serviceName: string): void {
  // Create and configure NodeTracerProvider
  const provider = new NodeTracerProvider({
    plugins: {
      // http: { enabled: false },
      // https: { enabled: false },
      // grpc: { enabled: false },
      // dns: { enabled: false },
      // pg: { enabled: false },
      // "pg-pool": { enabled: false },
      // koa: { enabled: false },
      // ioredis: { enabled: false },
    },
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
