import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLString } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName } from "./module-plugin";
import { buildTableRowTypeFields, childRowResolver, parentRowResolver, resolveTableRows } from "./shared-functions";
import { TableRowWithProductFileName } from "../schema-types";
import { Context } from "../context";

/**
 * This file has specific schema and resolvers for the properties module
 */

const myModuleName = "properties";

export async function createModuleType(
  moduleName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  const propertyTable = tableByName["property"];
  const propertyValueTranslationRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property_value_translation", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["property.value.translation"].columns),
  });
  const propertyTranslationRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property_translation", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["property.translation"].columns),
  });
  const propertyValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property_value", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(tableByName["property.value"].columns),
      translations: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyValueTranslationRowType))),
        args: { language: { type: GraphQLString, description: "The language to get translations for" } },
        resolve: async (parent: TableRowWithProductFileName, args: { readonly language: string }, ctx: Context) => {
          const rows = await resolveTableRows(
            myModuleName,
            "property.value.translation",
            parent.__$productFileName$,
            ctx.loaders
          );
          return rows.filter(
            (row) =>
              row["builtin@parent_id"] === parent["builtin@id"] && (!args.language || row.language === args.language)
          );
        },
      },
    },
  });
  const propertyRowType = new GraphQLObjectType({
    name: getUniqueTypeName("property", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(propertyTable.columns),
      values: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyValueRowType))),
        resolve: childRowResolver(myModuleName, "property.value", true),
      },
      translations: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyTranslationRowType))),
        args: { language: { type: GraphQLString, description: "The language to get translations for" } },
        resolve: async (parent: TableRowWithProductFileName, args: { readonly language: string }, ctx: Context) => {
          const rows = await resolveTableRows(
            myModuleName,
            "property.translation",
            parent.__$productFileName$,
            ctx.loaders
          );
          return rows.filter(
            (row) =>
              row["builtin@parent_id"] === parent["builtin@id"] && (!args.language || row.language === args.language)
          );
        },
      },
    },
  });
  fields["property"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(propertyRowType))),
    description: propertyTable.description,
    resolve: parentRowResolver(myModuleName, "property"),
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}
