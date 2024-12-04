import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLString } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName } from "../module-plugin";
import { buildTableRowTypeFields, childRowResolver, parentRowResolver } from "./shared-functions";

/**
 * This file has specific schema and resolvers for the models module
 */

const myModuleName = "models";

export async function createModuleType(
  moduleName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {};
  const modelTable = tableByName["model"];
  const modelParamsTable = tableByName["model.params"];

  if (modelTable === undefined || modelParamsTable === undefined) {
    fields["models_type_error"] = {
      type: GraphQLString,
      description: "models type error: cannot find model/model.params",
    };
    return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
  }

  const modelParamsRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Model_Params", usedTypeNames),
    fields: buildTableRowTypeFields(modelParamsTable.columns),
  });

  const modelRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Model_Model", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(modelTable.columns),
      params: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(modelParamsRowType))),
        resolve: childRowResolver(myModuleName, "model.params", true),
      },
    },
  });

  fields["model"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(modelRowType))),
    description: modelTable.description,
    resolve: parentRowResolver(myModuleName, "model"),
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}
