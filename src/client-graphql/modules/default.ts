import { GraphQLObjectType, GraphQLFieldConfigMap, GraphQLNonNull, GraphQLList, GraphQLResolveInfo } from "graphql";
import { TableByName, ModuleFieldResolverParent } from "./module-plugin";
import { getUniqueTypeName, toSafeName } from "../shared-functions";
import { Context } from "../context";
import { resolveTable, buildTableRowTypeFields } from "./shared-functions";

/**
 * This is the default generic handling for modules
 */

export async function createModuleType(
  moduleFieldName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
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
      resolve: (parent: ModuleFieldResolverParent, _args: {}, ctx: Context, info: GraphQLResolveInfo) => {
        return resolveTable(parent.module, parent.productFileName, info.fieldName, ctx.loaders);
      },
    };
  }
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleFieldName}`, usedTypeNames), fields });
}
