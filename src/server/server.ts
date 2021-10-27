import * as Config from "./config";
import { initOtel } from "./init-otel";
if (Config.config.initOtel === "true") {
  initOtel("promaster-api", Config.config);
  console.log("OpenTelemetry SDK initialized.");
}
require("./start-server").startServer(Config.config); // tslint:disable-line
