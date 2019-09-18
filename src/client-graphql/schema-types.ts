export interface Marker {
  readonly markerName: string;
  // If this marker is a release marker then it will point to a releaseId
  readonly releaseId?: string;
  readonly releaseName?: string;
  // If this marker is a latest marker then it will point to a transactionId
  readonly transactionId?: string;
  readonly products?: ReadonlyArray<Product>;
}

export interface Product {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly retired: boolean;
  readonly transactionId: string;
}
