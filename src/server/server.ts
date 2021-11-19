import * as Config from "./config";
import { initOtel } from "./otel";
if (Config.config.initOtel === "true") {
  initOtel();
  console.log("OpenTelemetry SDK initialized.");
}
require("./start-server").startServer(Config.config); // tslint:disable-line
