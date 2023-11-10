import path from "path";
import { getApiProductTables, readJsonFile } from "./middleware";
import { describe, it, expect } from "vitest";
import { ProductFile, ReleaseFile, RootFile, TransactionFile } from "../file-types";
import * as fs from "fs/promises";
import { ApiTables } from "./types";

describe("getApiProductTables", async () => {
  const testsFolder = path.join(__dirname, "middleware-test-files");
  const testNames = await fs.readdir(testsFolder);

  for (const testName of testNames) {
    const currentTestFilesFolder = path.join(testsFolder, testName);
    const filesDir = path.join(currentTestFilesFolder, "files-dir");

    it(testName, async () => {
      const rootFile = await readJsonFile<RootFile>(filesDir, "root.json");

      const productsData: ApiTables[] = [];
      const releasePrefix = "release_";
      const transactionPrefix = "transaction_";
      const releaseAndTransactionFileNames = [...Object.values(rootFile.refs)].filter(
        (ref) =>
          ref.substring(0, releasePrefix.length) === releasePrefix ||
          ref.substring(0, releasePrefix.length) === transactionPrefix
      );
      for (const releaseFileName of releaseAndTransactionFileNames) {
        const releaseFile = await readJsonFile<ReleaseFile | TransactionFile>(filesDir, releaseFileName);
        for (const productFileName of Object.values(releaseFile.refs)) {
          const productFile = await readJsonFile<ProductFile>(filesDir, productFileName);
          const legacyTableList = await readJsonFile<readonly string[]>(
            currentTestFilesFolder,
            "legacy-table-list.json"
          );
          const apiTables = await getApiProductTables(filesDir, "", productFile, legacyTableList);

          productsData.push(apiTables);
        }
      }

      const result = await readJsonFile(currentTestFilesFolder, "result.json");

      expect(productsData).toEqual(result);
    });
  }
});
