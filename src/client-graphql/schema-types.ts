import { ProductTableFileCell } from "../file-types";

export interface Query {
  readonly trees: ReadonlyArray<Tree>;
  readonly marker: Marker;
  readonly products: ReadonlyArray<Product>;
  readonly product: Product | null;
}

export interface Tree {
  readonly name: string;
}

export interface Marker {
  readonly markerName: string;
  // If this marker is a release marker then it will point to a releaseId
  readonly releaseId?: string;
  readonly releaseName?: string;
  // If this marker is a latest marker then it will point to a transactionId
  readonly tx?: string;
}

export interface Product {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly retired: boolean;
  readonly modules: Modules;
}

export interface Modules {
  readonly [module: string]: Module;
}

export interface Module {
  readonly [table: string]: ReadonlyArray<TableRow>;
}

export interface TableRow {
  readonly [column: string]: ProductTableFileCell;
}

export interface TableRowWithProductFileName {
  readonly __$productFileName$: string;
  readonly [column: string]: ProductTableFileCell;
}
