export interface Marker {
  readonly markerName: string;
  readonly releaseName?: string;
  readonly releaseId?: string;
  readonly transactionId?: string;
  readonly products: string;
}
