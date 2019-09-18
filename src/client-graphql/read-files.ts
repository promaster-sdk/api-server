import path from "path";
import fs from "fs";
import { promisify } from "util";
import Koa from "koa";
import { GetFilesDir } from "./context";
import { Marker } from "./schema-types";
import { getTypeAndIdentifierFromFileName, ReleaseFile, parseTransactionFileName } from "../file-types";

const readFileAsync = promisify(fs.readFile);

export async function readJsonFile<T>(filesDir: string, fileName: string): Promise<T> {
  const fullPath = path.join(filesDir, fileName);
  const content = JSON.parse(await readFileAsync(fullPath, "utf8"));
  return content;
}

export async function markerFileNameToApiMarker(
  ctx: Koa.Context,
  getFilesDir: GetFilesDir,
  markerName: string,
  fileName: string
): Promise<Marker> {
  const typeAndId = getTypeAndIdentifierFromFileName(fileName);
  if (typeAndId.type === "release") {
    const releaseContent = await readJsonFile<ReleaseFile>(getFilesDir(ctx), fileName);
    return {
      markerName: markerName,
      releaseName: releaseContent.data.name,
      releaseId: releaseContent.data.id.toUpperCase(),
    };
  } else if (typeAndId.type === "transaction") {
    const parsed = parseTransactionFileName(fileName);
    const tx = parsed.tx;
    return {
      markerName: markerName,
      transactionId: tx.toString(),
    };
  } else {
    throw new Error("Invalid file type.");
  }
}

export function toSafeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}
