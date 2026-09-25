import * as fs from "fs/promises";
import * as os from "os";
import path from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { getApiProductTables } from "./middleware";
import { ProductFile, ProductTableFile } from "../file-types";

const productFile: ProductFile = {
  data: { id: "p1", key: "P1", name: "P1", retired: false, tables: { "custom_tables@images": 0 } },
  refs: { 0: "table_t1@1.json" },
} as unknown as ProductFile;

const tableFile = {
  data: {
    id: "t1",
    module: "custom_tables",
    name: "images",
    description: "",
    columns: [
      { type: "PrimaryKey", name: "builtin@id" },
      { type: "Number", name: "sort_no" },
      { type: "Blob", name: "image" },
    ],
    rows: [
      ["r1", 0, { hash: "aaa", mimeType: "image/png" }],
      ["r2", 1, "bbb"],
      ["r3", 2, null],
    ],
  },
  refs: {},
} as unknown as ProductTableFile;

describe("REST blob columns", () => {
  const filesDir = path.join(os.tmpdir(), "api-server-blob-mime-type-test");
  beforeAll(async () => {
    await fs.mkdir(filesDir, { recursive: true });
    await fs.writeFile(path.join(filesDir, "table_t1@1.json"), JSON.stringify(tableFile));
  });

  it("returns the url string by default, for both published blob cell types", async () => {
    const tables = await getApiProductTables(filesDir, "http://x", productFile, ["*"]);
    expect(tables["ct_images"].map((r) => r["image"])).toEqual(["http://x/blobs/aaa", "http://x/blobs/bbb", null]);
  });

  it("returns { url, mimeType } objects with blobMimeType", async () => {
    const tables = await getApiProductTables(filesDir, "http://x", productFile, ["*"], true);
    expect(tables["ct_images"].map((r) => r["image"])).toEqual([
      { url: "http://x/blobs/aaa", mimeType: "image/png" },
      { url: "http://x/blobs/bbb", mimeType: null },
      null,
    ]);
  });
});
