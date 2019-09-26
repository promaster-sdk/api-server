import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName, ModuleFieldResolverParent } from "./module-plugin";
import { Context } from "../context";
import {
  resolveTableRows,
  buildTableRowTypeFields,
  getProductFileNameFromRow as getProductFileName,
  filterOnParent,
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
  const propertyValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property_value", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["property.value"].columns),
  });
  const propertyRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(propertyTable.columns),
      values: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyValueRowType))),
        resolve: async (parent, _args, ctx) => {
          const rows = await resolveTableRows("properties", "property.value", getProductFileName(parent), ctx.loaders);
          return rows.filter(filterOnParent(parent));
        },
      },
    },
  });
  fields["property"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(propertyRowType))),
    description: propertyTable.description,
    resolve: async (parent: ModuleFieldResolverParent, _args, ctx: Context) =>
      resolveTableRows(parent.module, "property", parent.productFileName, ctx.loaders, true),
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}
