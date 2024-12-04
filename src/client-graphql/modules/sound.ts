import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList, GraphQLString } from "graphql";
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
  const soundVariantDamperTable = tableByName["sound_variant.damper"];
  const soundVariantSoundlineTable = tableByName["sound_variant.sound_line"];
  const soundVariantSoundTable = tableByName["sound_variant.sound"];

  if (
    soundVariantTable === undefined ||
    soundVariantDamperTable === undefined ||
    soundVariantSoundlineTable === undefined ||
    soundVariantSoundTable === undefined
  ) {
    fields["sound_type_error"] = {
      type: GraphQLString,
      description:
        "sound type error: cannot find sound_variant/sound_variant.damper/sound_variant.sound_line/sound_variant.sound",
    };
    return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
  }

  const damperRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_Damper", usedTypeNames),
    fields: buildTableRowTypeFields(soundVariantDamperTable.columns),
  });

  const soundLineRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_SoundLine", usedTypeNames),
    fields: buildTableRowTypeFields(soundVariantSoundlineTable.columns),
  });

  const soundRowType = new GraphQLObjectType({
    name: getUniqueTypeName("Sound_Sound", usedTypeNames),
    fields: buildTableRowTypeFields(soundVariantSoundTable.columns),
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
