export function getUniqueTypeName(requestedName: string, usedTypeNames: Set<string>): string {
  if (usedTypeNames.has(requestedName)) {
    return getUniqueTypeName(requestedName + "A", usedTypeNames);
  }
  usedTypeNames.add(requestedName);
  return requestedName;
}

export function toSafeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_");
}
