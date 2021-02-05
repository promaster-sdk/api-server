import * as Config from "./config";
import { initOtel } from "./init-otel";
initOtel("promaster-api", Config.config);
require("./start-server").startServer(Config.config);
