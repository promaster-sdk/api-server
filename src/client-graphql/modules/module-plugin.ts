import { GraphQLObjectType, GraphQLResolveInfo } from "graphql";
import { ProductTableFileColumn } from "../../file-types";
import { Context } from "../context";

export interface TableByName {
  readonly [tableName: string]: Table;
}

export interface Table {
  readonly description: string;
  readonly columns: ReadonlyArray<ProductTableFileColumn>;
}

export interface ModulePlugin {
  readonly createModuleType: (
    moduleFieldName: string,
    usedTypeNames: Set<string>,
    tableByName: TableByName
  ) => Promise<GraphQLObjectType>;
  readonly resolveModuleType: (
    parent: unknown,
    _args: { readonly [key: string]: unknown },
    ctx: Context,
    info: GraphQLResolveInfo
  ) => unknown;
}

export interface ModuleFieldResolverParent {
  readonly module: string;
  readonly productFileName: string;
}
