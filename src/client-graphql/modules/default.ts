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
import { TableByName } from "./module-plugin";
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
  return await buildModuleType(moduleFieldName, tableByName, usedTypeNames);
}

export function resolveModuleType(
  parent: string,
  _args: {},
  _ctx: Context,
  info: GraphQLResolveInfo
): ModuleFieldResolverParent {
  return { module: info.fieldName, productFileName: parent };
}

async function buildModuleType(
  moduleName: string,
  tableDefs: TableByName,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const fields: GraphQLFieldConfigMap<unknown, unknown, unknown> = {};
  for (const [n, v] of Object.entries(tableDefs)) {
    const tableFieldName = toSafeName(n);
    fields[tableFieldName] = {
      type: new GraphQLNonNull(
        GraphQLList(new GraphQLNonNull(await buildTableRowType(tableFieldName, v.columns, usedTypeNames)))
      ),
      description: v.description,
      resolve: moduleTableResolver,
    };
  }
  const moduleType = new GraphQLObjectType({ name: getUniqueTypeName(`Module_${moduleName}`, usedTypeNames), fields });
  return moduleType;
}

async function buildTableRowType(
  tableSafeName: string,
  columns: ReadonlyArray<ProductTableFileColumn>,
  usedTypeNames: Set<string>
): Promise<GraphQLObjectType> {
  const tableType = new GraphQLObjectType({
    name: getUniqueTypeName(tableSafeName, usedTypeNames),
    fields: Object.fromEntries(
      columns.map((c) => [toSafeName(c.name), { type: columnTypeToGraphQLType(c), description: c.description }])
    ),
  });
  return tableType;
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

interface ModuleFieldResolverParent {
  readonly module: string;
  readonly productFileName: string;
}

export async function moduleTableResolver(
  parent: ModuleFieldResolverParent,
  _args: {},
  ctx: Context,
  info: GraphQLResolveInfo
): Promise<ReadonlyArray<TableRow>> {
  const fullTableName = `${parent.module}@${info.fieldName}`;
  const productFile = await ctx.loaders.productFiles.load(parent.productFileName);
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
