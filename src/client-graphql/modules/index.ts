export * from "./module-plugin";

// import * as Properties from "./properties";
import * as Default from "./default";
import { ModulePlugin } from "./module-plugin";

export const defaultModulePlugin: ModulePlugin = Default;

// export const modulePlugins: { readonly [name: string]: ModulePlugin } = {
//   properties: Properties,
// };

export const modulePlugins: { readonly [name: string]: ModulePlugin } = {};
