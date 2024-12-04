import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLString } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName } from "../module-plugin";
import {
  buildTableRowTypeFields,
  childRowResolver,
  parentRowResolver,
  resolveTableRows,
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
  const propertyDefValueTable = tableByName["property.def_value"];
  const propertyValueTable = tableByName["property.value"];

  if (propertyTable === undefined || propertyDefValueTable === undefined || propertyValueTable === undefined) {
    fields["property_type_error"] = {
      type: GraphQLString,
      description: "property type error: cannot find property/property.def_value/property.value",
    };
    return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
  }

  const propertyValueTranslationRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_ValueTranslation", usedTypeNames),
    fields: buildTableRowTypeFields(
      // Fall back on hardcoded schema to fake translations from the text table.
      tableByName["property.value.translation"]?.columns ?? [
        { type: "PrimaryKey", name: "builtin@id" },
        { type: "Number", name: "sort_no" },
        { type: "ForeignKey", name: "builtin@parent_id", params: "property.value" },
        { type: "DynamicDiscrete", name: "language", params: "language.name", key: true },
        { type: "Text", name: "translation" },
      ]
    ),
  });

  const propertyTranslationRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_Translation", usedTypeNames),
    fields: buildTableRowTypeFields(
      // Fall back on hardcoded schema to fake translations from the text table.
      tableByName["property.translation"]?.columns ?? [
        { type: "PrimaryKey", name: "builtin@id" },
        { type: "Number", name: "sort_no" },
        { type: "ForeignKey", name: "builtin@parent_id", params: "property" },
        { type: "DynamicDiscrete", name: "language", params: "language.name", key: true },
        { type: "FixedDiscrete", name: "type", params: "standard,long" },
        { type: "Text", name: "translation" },
      ]
    ),
  });

  const propertyDefaultValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_DefaultValue", usedTypeNames),
    fields: buildTableRowTypeFields(propertyDefValueTable.columns),
  });

  const propertyValueRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Property_Value", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(propertyValueTable.columns),
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
  const parentId = parent[builtinIdColumnSafeName];
  const parentName = parent["name"];
  const parentValue = parent["value"];
  const grandParentName = parent["__$parentName$"];

  return resolveTableRows(
    moduleName,
    tableName,
    parent.__$productFileName$,
    ctx.loaders,
    includeProductFileName,
    typeof parentId !== "string"
      ? undefined
      : {
          id: parentId.toString(),
          name: parentName?.toString(),
          value: parentValue?.toString(),
        },
    typeof grandParentName !== "string"
      ? undefined
      : {
          name: grandParentName,
        },
    args.language
  );
};
