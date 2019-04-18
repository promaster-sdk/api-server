import path from "path";
import convict from "convict";

export interface Config {
  readonly ip: string;
  readonly port: number;
  readonly filesPath: string;
  readonly publishAuthorization: string;
}

export const schema = convict<Config>({
  ip: {
    doc: "The IP address to bind.",
    format: "ipaddress",
    default: "0.0.0.0",
    env: "IP_ADDRESS",
  },
  port: {
    doc: "The port to bind.",
    format: "port",
    default: 4500,
    env: "PORT",
  },
  filesPath: {
    doc: "Where to store the published files.",
    format: "String",
    default: path.join(__dirname, "../../uploads/"),
    env: "FILES_PATH",
  },
  publishAuthorization: {
    doc: "String sent in Authorization http header, will be verified to allow publishing.",
    format: "String",
    default: "NOT-SET",
    env: "PUBLISH_AUTHORIZATION",
    sensitive: true,
  },
});

schema.validate({ allowed: "strict" });

export const config = schema.getProperties();
