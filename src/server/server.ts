import * as Config from "./config";
import { initOtel } from "./init-otel";
initOtel("promaster-api");
require("./start-server").startServer(Config.config);
