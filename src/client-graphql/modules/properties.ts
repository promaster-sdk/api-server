import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLFloat } from "graphql";
import { getUniqueTypeName, toSafeName } from "../shared-functions";
import { TableByName } from "./module-plugin";
import { moduleTableResolver, buildTableRowTypeFields } from "./default";

/**
 * This file has specific schema and resolvers for the properties module
 */

export async function createModuleType(
  moduleName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableByName)) {
    const tableFieldName = toSafeName(n);
    let tableRowType;
    if (n === "property") {
      tableRowType = new GraphQLObjectType({
        name: getUniqueTypeName(tableFieldName, usedTypeNames),
        fields: { ...buildTableRowTypeFields(v.columns), olle: { type: GraphQLFloat } },
      });
    } else {
      tableRowType = new GraphQLObjectType({
        name: getUniqueTypeName(tableFieldName, usedTypeNames),
        fields: buildTableRowTypeFields(v.columns),
      });
    }
    fields[tableFieldName] = {
      type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(tableRowType))),
      description: v.description,
      resolve: moduleTableResolver,
    };
  }
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}

export { resolveModuleType } from "./default";
