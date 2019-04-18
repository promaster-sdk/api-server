/**
 * Defines the files that we send to the api server's publish endpoint.
 */
export type FileType = "root" | "transaction" | "release" | "product" | "table" | "blob" | "tree";

export interface RootFile {
  readonly data: {
    readonly markers: FileRefMap;
    readonly latest: LatestTransaction;
    readonly trees: FileRefMap;
  };
  readonly refs: FileRefResolutionMap;
}

export interface LatestTransaction {
  readonly tx: number;
  readonly date: number;
  readonly transaction: number;
}

export interface TreeFile {
  readonly id: string;
  readonly name: string;
  readonly relations: ReadonlyArray<TreeRelation>;
}

export interface TreeRelation {
  readonly childId: string;
  readonly parentId?: string | undefined;
  readonly sortNo: number;
}

/**
 * File that holds all products as they looked at a given transaction
 */
export interface TransactionFile {
  readonly data: {
    readonly tx: number;
    readonly date: number;
    readonly products: FileRefMap;
  };
  readonly refs: FileRefResolutionMap;
}

export interface ReleaseFile {
  readonly data: {
    readonly id: string;
    readonly name: string;
    readonly products: FileRefMap;
  };
  readonly refs: FileRefResolutionMap;
}

export interface ProductFile {
  readonly data: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
    readonly description: string;
    readonly retired: boolean;
    readonly tables: FileRefMap;
  };
  readonly refs: FileRefResolutionMap;
}

export interface ProductTableFile {
  readonly data: {
    readonly id: string;
    readonly module: string;
    readonly name: string;
    readonly description: string;
    readonly columns: ReadonlyArray<ProductTableFileColumn>;
    readonly rows: ReadonlyArray<ProductTableFileRow>;
  };
  readonly refs: FileRefResolutionMap;
}

export interface ProductTableFileColumn {
  readonly type: ProductTableFileColumnType;
  readonly name: string;
  readonly params?: string;
  readonly key?: boolean;
  readonly description?: string;
}

export const builtinIdColumnName = "builtin@id";
export const builtinParentIdColumnName = "builtin@parent_id";
export const builtinSortNoColumnName = "sort_no";

export enum ProductTableFileColumnType {
  Text = "Text",
  LongText = "LongText",
  PropertyFilter = "PropertyFilter",
  PropertyValues = "PropertyValues",
  Blob = "Blob",
  FixedDiscrete = "FixedDiscrete",
  DynamicDiscrete = "DynamicDiscrete",
  // Columns of type "Table" are deprecated and not used in the file formats
  // Table = "Table",
  Number = "Number",
  Product = "Product",
  Property = "Property",
  Quantity = "Quantity",
  Unit = "Unit",
  TextId = "TextId",
  // Columns of type "PrimaryKey" and "ForeignKey" are new
  // and not present in the database yet but we derive them
  // from the id and parent_id column in the database
  PrimaryKey = "PrimaryKey",
  ForeignKey = "ForeignKey",
}

export type ProductTableFileRow = ReadonlyArray<ProductTableFileCell>;
export type ProductTableFileCell = string | number | null;

export interface FileRefMap {
  readonly [key: string]: number;
}

export interface FileRefResolutionMap {
  readonly [key: string]: string;
}

export function buildReleaseFileName(releaseId: string): string {
  return `release_${releaseId.toLocaleLowerCase()}.json`;
}

export function buildProductFileName(productId: string, tx: string): string {
  return `product_${productId.toLocaleLowerCase()}@${tx}.json`;
}

export function buildTransactionFileName(tx: string): string {
  return `transaction_${tx}.json`;
}

export function buildProductTableFileName(tableId: string, tx: string): string {
  return `table_${tableId.toLowerCase()}@${tx}.json`;
}

export function buildTreeFileName(treeId: string, hash: string): string {
  return `tree_${treeId.toLowerCase()}@${hash.toLowerCase()}.json`;
}

export function buildBlobFileName(hash: string): string {
  return `blob_${hash.toLowerCase()}`;
}

export function buildRootFileName(): string {
  return "root.json";
}

export function parseReleaseFileName(fileName: string): { readonly releaseId: string } {
  const idPart = fileName.substring("release_".length, fileName.length - ".json".length);
  return { releaseId: idPart };
}

export function parseTransactionFileName(fileName: string): { readonly tx: string } {
  // transaction_554035.json
  const txPart = fileName.substring("transaction_".length, fileName.length - ".json".length);
  return { tx: txPart };
}

export function parseProductFileName(fileName: string): { readonly productId: string; readonly tx: string } {
  // product_ffe915b0-4800-11e8-e030-93bd83df2e66@533250.json
  const idPart = fileName.substring("product_".length, fileName.length - ".json".length);
  return parseProductFileIdentifier(idPart);
}

export function parseProductFileIdentifier(
  fileIdentifier: string
): { readonly productId: string; readonly tx: string } {
  // ffe915b0-4800-11e8-e030-93bd83df2e66@533250
  const parts = fileIdentifier.split("@");
  return {
    productId: parts[0],
    tx: parts[1],
  };
}

export function parseProductTableFileName(fileName: string): { readonly tableId: string; readonly tx: string } {
  // table_ffe915b0-4800-11e8-e030-93bd83df2e66@533250.json
  const idPart = fileName.substring("table_".length, fileName.length - ".json".length);
  return parseProductTableFileIdentifier(idPart);
}

export function parseProductTableFileIdentifier(
  fileIdentifier: string
): { readonly tableId: string; readonly tx: string } {
  // ffe915b0-4800-11e8-e030-93bd83df2e66@533250
  const parts = fileIdentifier.split("@");
  return {
    tableId: parts[0],
    tx: parts[1],
  };
}

/**
 * For example "product_324234234@12312.json" => ["product", "324234234@12312"]
 */
export function getTypeAndIdentifierFromFileName(
  fileName: string
): { readonly type: FileType; readonly identifier: string } {
  // Pick the first part of the file name becuase that will determine the type of file
  const fileNameWithoutSuffix = fileName.endsWith(".json")
    ? fileName.substr(0, fileName.length - ".json".length)
    : fileName;
  const fileNameParts = fileNameWithoutSuffix.split("_");
  return { type: fileNameParts[0] as FileType, identifier: fileNameParts[1] };
}
