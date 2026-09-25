import { GraphQLObjectType, GraphQLFieldConfigMap, GraphQLNonNull, GraphQLList, GraphQLResolveInfo } from "graphql";
import { TableByName, ModuleFieldResolverParent } from "../module-plugin.js";
import { getUniqueTypeName, toSafeName } from "../shared-functions.js";
import { Context } from "../context.js";
import { resolveTableRows, buildTableRowTypeFields } from "./shared-functions.js";

/** This is the default generic handling for modules */

export async function createModuleType(
  moduleFieldName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName,
  blobType?: GraphQLObjectType
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableByName)) {
    if (n !== "") {
      const tableFieldName = toSafeName(n);
      const tableRowType = new GraphQLObjectType({
        name: getUniqueTypeName(tableFieldName, usedTypeNames),
        fields: buildTableRowTypeFields(v.columns, blobType),
      });
      fields[tableFieldName] = {
        type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(tableRowType))),
        description: v.description,
        resolve: (parent: ModuleFieldResolverParent, _args: {}, ctx: Context, info: GraphQLResolveInfo) => {
          return resolveTableRows(parent.module, info.fieldName, parent.productFileName, ctx.loaders, false, undefined, undefined, undefined);
        },
      };
    }
  }
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleFieldName}`, usedTypeNames), fields });
}
