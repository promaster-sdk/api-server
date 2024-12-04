import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLString } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { ModuleFieldResolverParent, TableByName } from "../module-plugin";
import { buildTableRowTypeFields, parentRowResolver } from "./shared-functions";
import { Context } from "../context";

/**
 * This file has specific schema and resolvers for the texts module
 */

const myModuleName = "texts";

export async function createModuleType(
  moduleName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {};
  const textTable = tableByName["text"];

  if (textTable === undefined) {
    fields["texts_type_error"] = {
      type: GraphQLString,
      description: "texts type error: cannot find text",
    };
    return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
  }

  const textRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Texts_Text", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(textTable.columns),
    },
  });

  fields["text"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(textRowType))),
    args: {
      language: { type: GraphQLString },
      name: { type: GraphQLString },
    },
    description: textTable.description,
    resolve: async (
      parent: ModuleFieldResolverParent,
      args: { readonly language?: string; readonly name?: string },
      ctx: Context
    ) => {
      let rows = await parentRowResolver(myModuleName, "text")(parent, args, ctx);
      if (args.name !== undefined) {
        rows = rows.filter((r) => r["name"] === args.name);
      }
      if (args.language !== undefined) {
        rows = rows.filter((r) => r["language"] === args.language);
      }
      return rows;
    },
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}
