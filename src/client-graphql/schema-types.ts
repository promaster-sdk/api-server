import { ProductTableFileCell } from "../file-types";

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
  readonly _fileName: string;
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
