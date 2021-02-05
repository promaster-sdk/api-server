import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName } from "../module-plugin";
import { buildTableRowTypeFields, childRowResolver, parentRowResolver } from "./shared-functions";

/**
 * This file has specific schema and resolvers for the properties module
 */

const myModuleName = "sound";

export async function createModuleType(
  moduleName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {};
  const soundVariantTable = tableByName["sound_variant"];

  const damperRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_Damper", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["sound_variant.damper"].columns),
  });

  const soundLineRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_SoundLine", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["sound_variant.sound_line"].columns),
  });

  const soundRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_Sound", usedTypeNames),
    fields: buildTableRowTypeFields(tableByName["sound_variant.sound"].columns),
  });

  const soundVariantRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_SoundVariant", usedTypeNames),
    fields: {
      ...buildTableRowTypeFields(soundVariantTable.columns),
      sound: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(soundRowType))),
        resolve: childRowResolver(myModuleName, "sound_variant.sound", true),
      },
      sound_line: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(soundLineRowType))),
        resolve: childRowResolver(myModuleName, "sound_variant.sound_line", true),
      },
      damper: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(damperRowType))),
        resolve: childRowResolver(myModuleName, "sound_variant.damper", true),
      },
    },
  });

  fields["sound_variant"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(soundVariantRowType))),
    description: soundVariantTable.description,
    resolve: parentRowResolver(myModuleName, "sound_variant"),
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}
