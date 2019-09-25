import { GraphQLObjectType, GraphQLNonNull, GraphQLFieldConfigMap, GraphQLList } from "graphql";
import { getUniqueTypeName } from "../shared-functions";
import { TableByName, ModuleFieldResolverParent } from "./module-plugin";
import { buildTableRowTypeFields, resolveTable } from "./default";
import { Context } from "../context";

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
          console.log("Resolve values...", parent);
          const rows = await resolveTable("properties", parent._productFileName, "property.value", ctx);
          return rows;
        },
      },
    },
  });
  fields["property"] = {
    type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(propertyTableRowType))),
    description: propertyTable.description,
    // resolve: moduleTableResolver,
    resolve: async (parent: ModuleFieldResolverParent, _args, ctx: Context) => {
      console.log("Resolve property", parent);
      const rows = await resolveTable(parent.module, parent.productFileName, "property", ctx);
      // tslint:disable-next-line:no-any
      for (const r of rows) {
        // tslint:disable-next-line:no-any
        (r as any)._productFileName = parent.productFileName;
      }
      return rows;
    },
  };
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}

export { resolveModuleType } from "./default";

// export async function propertyTableResolver(
//   parent: ModuleFieldResolverParent,
//   args: {},
//   ctx: Context,
//   info: GraphQLResolveInfo
// ): Promise<ReadonlyArray<TableRow>> {
//   const rows = await moduleTableResolver(parent, args, ctx, info);
//   return rows;
// }

// export async function propertyRowResolver(
//   parent: ProductTableFileRow,
//   args: {},
//   ctx: Context,
//   info: GraphQLResolveInfo
// ): Promise<ReadonlyArray<TableRow>> {
//   const rows = await moduleTableResolver(parent, args, ctx, info);
//   return rows;
// }
