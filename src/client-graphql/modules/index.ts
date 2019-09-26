export * from "./module-plugin";

import * as Properties from "./properties";
import * as Default from "./default";
import { ModulePlugin } from "./module-plugin";
import { GraphQLResolveInfo } from "graphql";

export const defaultModulePlugin: ModulePlugin = Default;

export const modulePlugins: { readonly [name: string]: ModulePlugin } = {
  properties: Properties,
};

export const defaultResolveModuleType = (parent: string, _args: {}, _ctx: {}, info: GraphQLResolveInfo) => {
  return { module: info.fieldName, productFileName: parent };
};
