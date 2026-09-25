import * as Config from "./config.js";
import { initOtel } from "./otel.js";

async function main(): Promise<void> {
  if (Config.config.otelEnable === "true") {
    await initOtel();
  }
  // Imported after initOtel() so instrumentations can patch modules before they load
  (await import("./start-server.js")).startServer(Config.config);
}

main();
