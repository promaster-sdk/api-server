export function getUniqueTypeName(requestedName: string, usedTypeNames: Set<string>): string {
  const safeRequestedName = toSafeName(requestedName);
  if (usedTypeNames.has(safeRequestedName)) {
    return getUniqueTypeName(requestedName + "A", usedTypeNames);
  }
  usedTypeNames.add(safeRequestedName);
  return safeRequestedName;
}

export function toSafeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_");
}
