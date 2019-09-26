import * as DataLoader from "dataloader";
import { GraphQLFieldConfigMap, GraphQLScalarType, GraphQLFloat, GraphQLString } from "graphql";
import { ProductFile, ProductTableFile, ProductTableFileColumn, ProductTableFileColumnType } from "../../file-types";
import { TableRow } from "../schema-types";
import { toSafeName } from "../shared-functions";

const productFileNameKey = "__$ProductFileName";

export async function resolveTableRows(
  module: string,
  tableName: string,
  productFileName: string,
  loaders: {
    readonly productFiles: DataLoader<string, ProductFile>;
    readonly tableFiles: DataLoader<string, ProductTableFile>;
  },
  includeProductFileName: boolean = false
): Promise<ReadonlyArray<TableRow>> {
  const fullTableName = `${module}@${tableName}`;
  const productFile = await loaders.productFiles.load(productFileName);
  const tableRef = productFile.data.tables[fullTableName];
  const tableFileName = productFile.refs[tableRef];
  if (!tableFileName) {
    return [];
  }
  const tableFile = await loaders.tableFiles.load(tableFileName);
  if (includeProductFileName) {
    return tableFile.data.rows.map((values) => {
      const obj = Object.fromEntries(tableFile.data.columns.map((c, i) => [c.name, values[i]]));
      obj[productFileNameKey] = productFileName;
      return obj;
    });
  } else {
    return tableFile.data.rows.map((values) =>
      Object.fromEntries(tableFile.data.columns.map((c, i) => [c.name, values[i]]))
    );
  }
}

export function getProductFileNameFromRow(row: TableRow): string {
  // tslint:disable-next-line:no-any
  return (row as any)[productFileNameKey];
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

export const filterOnParent = (parent: TableRow) => (row: TableRow) => {
  return row["builtin@parent_id"] === parent["builtin@id"];
};
