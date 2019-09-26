import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName, ModuleFieldResolverParent } from "./module-plugin";
import { Context } from "../context";
import {
  resolveTable,
  buildTableRowTypeFields,
  getProductFileNameFromRow as getProductFileName,
} from "./shared-functions";

/**
 * This file has specific schema and resolvers for the properties module
 */

export async function createModuleType(
  moduleName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  const propertyTable = tableByName["property"];
  const propertyValueTable = tableByName["property.value"];
  const propertyValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property_value", usedTypeNames),
    fields: buildTableRowTypeFields(propertyValueTable.columns),
  });
  const propertyTableRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(propertyTable.columns),
      values: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyValueRowType))),
        resolve: async (parent, _args, ctx) => {
          const rows = await resolveTable("properties", getProductFileName(parent), "property.value", ctx.loaders);
          return rows.filter((r) => r["builtin@parent_id"] === parent["builtin@id"]);
        },
      },
    },
  });
  fields["property"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(propertyTableRowType))),
    description: propertyTable.description,
    resolve: async (parent: ModuleFieldResolverParent, _args, ctx: Context) =>
      resolveTable(parent.module, parent.productFileName, "property", ctx.loaders, true),
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}

export { resolveModuleType } from "./default";
