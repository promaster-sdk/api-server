import * as Config from "./config";
import { initOtel } from "./init-otel";
initOtel().then(() => require("./start-server").startServer(Config.config));
