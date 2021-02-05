import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLString } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName } from "../module-plugin";
import {
  buildTableRowTypeFields,
  childRowResolver,
  parentRowResolver,
  resolveTableRows,
  builtinParentIdColumnSafeName,
  builtinIdColumnSafeName,
} from "./shared-functions";
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
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {};
  const propertyTable = tableByName["property"];

  const propertyValueTranslationRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_ValueTranslation", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["property.value.translation"].columns),
  });

  const propertyTranslationRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_Translation", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["property.translation"].columns),
  });

  const propertyDefaultValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_DefaultValue", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["property.def_value"].columns),
  });

  const propertyValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_Value", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(tableByName["property.value"].columns),
      translations: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyValueTranslationRowType))),
        args: { language: { type: GraphQLString, description: "The language to get translations for" } },
        resolve: childRowResolverWithLanguageArg(myModuleName, "property.value.translation", true),
      },
    },
  });

  const propertyRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(propertyTable.columns),
      values: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyValueRowType))),
        resolve: childRowResolver(myModuleName, "property.value", true),
      },
      defaults: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyDefaultValueRowType))),
        resolve: childRowResolver(myModuleName, "property.def_value", true),
      },
      translations: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(propertyTranslationRowType))),
        args: { language: { type: GraphQLString, description: "The language to get translations for" } },
        resolve: childRowResolverWithLanguageArg(myModuleName, "property.translation", true),
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

const childRowResolverWithLanguageArg = (
  moduleName: string,
  tableName: string,
  includeProductFileName: boolean = false
) => async (parent: TableRowWithProductFileName, args: { readonly language: string }, ctx: Context) => {
  const rows = await resolveTableRows(
    moduleName,
    tableName,
    parent.__$productFileName$,
    ctx.loaders,
    includeProductFileName
  );
  return rows.filter(
    (row) =>
      row[builtinParentIdColumnSafeName] === parent[builtinIdColumnSafeName] &&
      (!args.language || row.language === args.language)
  );
};
