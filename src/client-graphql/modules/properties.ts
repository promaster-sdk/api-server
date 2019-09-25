import { GraphQLObjectType, GraphQLNonNull, GraphQLInt } from "graphql";
import { getUniqueTypeName } from "../shared-functions";

/**
 * This file has specific schema and resolvers for the properties module
 */

export async function createModuleType(
  _moduleFieldName: string,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const moduleType = new GraphQLObjectType({
    name: getUniqueTypeName("Properties_Module", usedTypeNames),
    fields: {
      olle: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });
  return moduleType;
}

export async function resolveModuleType(): Promise<null> {
  return null;
}
