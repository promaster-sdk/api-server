import * as Config from "./config";
import { initOtel } from "./otel";

async function main() {
  await initOtel();
  require("./start-server").startServer(Config.config); // tslint:disable-line
}

main();
