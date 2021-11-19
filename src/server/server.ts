import * as Config from "./config";
import { initOtel } from "./otel";

async function main(): Promise<void> {
  if (Config.config.otelEnable === "true") {
    await initOtel();
  }
  require("./start-server").startServer(Config.config); // tslint:disable-line
}

main();
