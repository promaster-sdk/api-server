export function getHeaderIgnoreCase(
  headers: { readonly [key: string]: string },
  headerName: string
): string | undefined {
  const headerNameLower = headerName.toLowerCase();
  const found = Object.keys(headers).filter((header) => header.toLowerCase() === headerNameLower);
  if (found.length > 0) {
    return headers[found[0]];
  }
  return undefined;
}
