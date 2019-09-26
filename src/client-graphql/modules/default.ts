import { GraphQLObjectType, GraphQLFieldConfigMap, GraphQLNonNull, GraphQLList, GraphQLResolveInfo } from "graphql";
import { TableByName, ModuleFieldResolverParent } from "./module-plugin";
import { getUniqueTypeName, toSafeName } from "../shared-functions";
import { Context } from "../context";
import { TableRow } from "../schema-types";
import { resolveTable, buildTableRowTypeFields } from "./shared-functions";

/**
 * This is the default generic handling for modules
 */

export async function createModuleType(
  moduleFieldName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  return buildModuleType(moduleFieldName, tableByName, usedTypeNames);
}

export function resolveModuleType(
  parent: string,
  _args: {},
  _ctx: Context,
  info: GraphQLResolveInfo
): ModuleFieldResolverParent {
  return { module: info.fieldName, productFileName: parent };
}

function buildModuleType(moduleName: string, tableByName: TableByName, usedTypeNames: Set<string>): GraphQLObjectType {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableByName)) {
    const tableFieldName = toSafeName(n);
    const tableRowType = new GraphQLObjectType({
      name: getUniqueTypeName(tableFieldName, usedTypeNames),
      fields: buildTableRowTypeFields(v.columns),
    });
    fields[tableFieldName] = {
      type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(tableRowType))),
      description: v.description,
      resolve: moduleTableResolver,
    };
  }
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}

async function moduleTableResolver(
  parent: ModuleFieldResolverParent,
  _args: {},
  ctx: Context,
  info: GraphQLResolveInfo
): Promise<ReadonlyArray<TableRow>> {
  return resolveTable(parent.module, parent.productFileName, info.fieldName, ctx.loaders);
}
