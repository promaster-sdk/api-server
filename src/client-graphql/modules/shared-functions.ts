import * as DataLoader from "dataloader";
import { GraphQLFieldConfigMap, GraphQLScalarType, GraphQLFloat, GraphQLString } from "graphql";
import {
  ProductFile,
  ProductTableFile,
  ProductTableFileColumn,
  ProductTableFileColumnType,
  ProductTableFileCell,
  ProductTableFileRow,
  builtinIdColumnName,
  builtinParentIdColumnName,
} from "../../file-types";
import { TableRow, TableRowWithProductFileName } from "../schema-types";
import { toSafeName } from "../shared-functions";
import { Context } from "../context";
import { ModuleFieldResolverParent } from "../module-plugin";
import { withSpan } from "../../tracing";

export const builtinParentIdColumnSafeName = toSafeName(builtinParentIdColumnName);
export const builtinIdColumnSafeName = toSafeName(builtinIdColumnName);

export async function resolveTableRows(
  module: string,
  tableName: string,
  productFileName: string,
  loaders: {
    readonly productFiles: DataLoader<string, ProductFile>;
    readonly tableFiles: DataLoader<string, ProductTableFile>;
  },
  includeProductFileName: boolean,
  filter: RowsFilter | undefined
): Promise<ReadonlyArray<TableRow> | ReadonlyArray<TableRowWithProductFileName>> {
  return withSpan("resolveTableRows", async () => {
    const fullTableName = `${module}@${tableName}`;
    const productFile = await loaders.productFiles.load(productFileName);
    const tableRef = productFile.data.tables[fullTableName];
    const tableFileName = productFile.refs[tableRef];
    if (!tableFileName) {
      return [];
    }
    interface MutableTableRowWithProductFileName {
      __$productFileName$: string;
      readonly [column: string]: ProductTableFileCell;
    }
    const tableFile = await loaders.tableFiles.load(tableFileName);
    if (includeProductFileName) {
      return filterRows(
        tableFile.data.rows.map((values) => {
          const obj = rowValuesToObject(tableFile.data.columns, values) as MutableTableRowWithProductFileName;
          obj.__$productFileName$ = productFileName;
          return obj;
        }),
        filter
      );
    } else {
      return filterRows(
        tableFile.data.rows.map((values) => rowValuesToObject(tableFile.data.columns, values)),
        filter
      );
    }
  });
}

interface RowsFilter {
  readonly parentRowId: string;
  readonly language: string | undefined;
}

function filterRows(
  rows: ReadonlyArray<TableRow> | ReadonlyArray<TableRowWithProductFileName>,
  filter: RowsFilter | undefined
): readonly TableRow[] {
  return !filter
    ? rows
    : rows.filter(
        (row) =>
          row[builtinParentIdColumnSafeName] === filter.parentRowId &&
          (!filter.language || row.language === filter.language)
      );
}

const rowValuesToObject = (columns: ReadonlyArray<ProductTableFileColumn>, values: ProductTableFileRow) =>
  Object.fromEntries(columns.map((c, i) => [toSafeName(c.name), values[i]]));

export function buildTableRowTypeFields(
  columns: ReadonlyArray<ProductTableFileColumn>
): GraphQLFieldConfigMap<unknown, unknown> {
  return Object.fromEntries(
    columns
      .filter((c) => c.name !== "")
      .map((c) => [toSafeName(c.name), { type: columnTypeToGraphQLType(c), description: c.description }])
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

export const parentRowResolver = (moduleName: string, tableName: string) => (
  parent: ModuleFieldResolverParent,
  _args: {},
  ctx: Context
) => {
  return resolveTableRows(moduleName, tableName, parent.productFileName, ctx.loaders, true, undefined);
};

export const childRowResolver = (moduleName: string, tableName: string, includeProductFileName: boolean) => async (
  parent: TableRowWithProductFileName,
  _args: {},
  ctx: Context
) => {
  return resolveTableRows(moduleName, tableName, parent.__$productFileName$, ctx.loaders, includeProductFileName, {
    parentRowId: parent[builtinIdColumnSafeName]?.toString() ?? "",
    language: undefined,
  });
};
