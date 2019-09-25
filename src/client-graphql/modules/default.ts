import {
  GraphQLObjectType,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLList,
  GraphQLScalarType,
  GraphQLFloat,
  GraphQLString,
  GraphQLResolveInfo,
} from "graphql";
import { TableByName, ModuleFieldResolverParent } from "./module-plugin";
import { getUniqueTypeName, toSafeName } from "../shared-functions";
import { ProductTableFileColumn, ProductTableFileColumnType } from "../..";
import { Context } from "../context";
import { TableRow } from "../schema-types";

/**
 * This is the default generic handling for modules
 */

export async function createModuleType(
  moduleFieldName: string,
  usedTypeNames: Set<string>,
  tableByName: TableByName
): Promise<GraphQLObjectType> {
  return buildModuleType(moduleFieldName, tableByName, usedTypeNames);
}

export function resolveModuleType(
  parent: string,
  _args: {},
  _ctx: Context,
  info: GraphQLResolveInfo
): ModuleFieldResolverParent {
  return { module: info.fieldName, productFileName: parent };
}

function buildModuleType(moduleName: string, tableByName: TableByName, usedTypeNames: Set<string>): GraphQLObjectType {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableByName)) {
    const tableFieldName = toSafeName(n);
    const tableRowType = new GraphQLObjectType({
      name: getUniqueTypeName(tableFieldName, usedTypeNames),
      fields: buildTableRowTypeFields(v.columns),
    });
    fields[tableFieldName] = {
      type: new GraphQLNonNull(GraphQLList(new GraphQLNonNull(tableRowType))),
      description: v.description,
      resolve: moduleTableResolver,
    };
  }
  return new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
}

export function buildTableRowTypeFields(
  columns: ReadonlyArray<ProductTableFileColumn>
): GraphQLFieldConfigMap<unknown, unknown> {
  return Object.fromEntries(
    columns.map((c) => [toSafeName(c.name), { type: columnTypeToGraphQLType(c), description: c.description }])
  );
}

function columnTypeToGraphQLType(c: ProductTableFileColumn): GraphQLScalarType {
  switch (c.type) {
    case ProductTableFileColumnType.Number:
      return GraphQLFloat;
    case ProductTableFileColumnType.Blob:
    case ProductTableFileColumnType.DynamicDiscrete:
    case ProductTableFileColumnType.FixedDiscrete:
    case ProductTableFileColumnType.ForeignKey:
    case ProductTableFileColumnType.LongText:
    case ProductTableFileColumnType.PrimaryKey:
    case ProductTableFileColumnType.Product:
    case ProductTableFileColumnType.Property:
    case ProductTableFileColumnType.PropertyFilter:
    case ProductTableFileColumnType.PropertyValues:
    case ProductTableFileColumnType.Quantity:
    case ProductTableFileColumnType.Text:
    case ProductTableFileColumnType.TextId:
    case ProductTableFileColumnType.Unit:
      return GraphQLString;
    default:
      return GraphQLString;
  }
}

export async function moduleTableResolver(
  parent: ModuleFieldResolverParent,
  _args: {},
  ctx: Context,
  info: GraphQLResolveInfo
): Promise<ReadonlyArray<TableRow>> {
  return resolveTable(parent.module, parent.productFileName, info.fieldName, ctx);
}

export async function resolveTable(
  module: string,
  productFileName: string,
  tableName: string,
  ctx: Context
): Promise<ReadonlyArray<TableRow>> {
  const fullTableName = `${module}@${tableName}`;
  const productFile = await ctx.loaders.productFiles.load(productFileName);
  const tableRef = productFile.data.tables[fullTableName];
  const tableFileName = productFile.refs[tableRef];
  if (!tableFileName) {
    return [];
  }
  const tableFile = await ctx.loaders.tableFiles.load(tableFileName);
  const rows = tableFile.data.rows.map((values) =>
    Object.fromEntries(tableFile.data.columns.map((c, i) => [c.name, values[i]]))
  );
  return rows;
}
