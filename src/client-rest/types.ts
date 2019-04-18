export declare type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export interface ApiMarker {
  readonly marker_name: string;
  readonly release_name?: string;
  readonly release_id?: string;
  readonly transaction_id?: string;
  readonly products: string;
}

export interface ApiRelease {
  readonly release_id: string;
  readonly release_name: string;
  readonly date: string;
  readonly products: string;
}

export interface ApiProduct {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly retired: boolean;
  readonly transaction_id: string;
  readonly tables: string;
  readonly all_tables: string;
  /**
   * The "data" key is only returned if the querystring specified tables=table1,table2
   */
  readonly data?: ApiTables;
}

export interface ApiTables {
  readonly [key: string /*TableName*/]: ReadonlyArray<ApiTableRow>;
}

// export type ApiTableRows = ReadonlyArray<ApiTableRow>;

export interface ApiTableRow {
  readonly [key: string]: string | number | boolean | null | ReadonlyArray<ApiTableRow>;
}
