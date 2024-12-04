import path from "path";
import { describe, it, expect } from "vitest";
import { ReleaseFile, RootFile, TransactionFile } from "../file-types";
import * as fs from "fs/promises";
import { readJsonFile } from "./middleware";
import { createSchema } from "./schema";
import { graphql } from "graphql";
import { createContext } from "./context";

describe("createSchema", async () => {
  const testsFolder = path.join(__dirname, "middleware-test-files");
  const testNames = await fs.readdir(testsFolder);

  for (const testName of testNames) {
    const currentTestFilesFolder = path.join(testsFolder, testName);
    const filesDir = path.join(currentTestFilesFolder, "files-dir");

    it(testName, async () => {
      const rootFile = await readJsonFile<RootFile>(filesDir)("root.json");

      const releasePrefix = "release_";
      const transactionPrefix = "transaction_";
      const markerRefs = [...Object.values(rootFile.refs)].filter(
        (ref) =>
          ref.substring(0, releasePrefix.length) === releasePrefix ||
          ref.substring(0, transactionPrefix.length) === transactionPrefix
      );

      const responses = await Promise.all(
        markerRefs.map(async (ref) => {
          const markerFile = await readJsonFile<ReleaseFile | TransactionFile>(filesDir)(ref);
          const schema = await createSchema(readJsonFile(filesDir), markerFile);
          const query = (await fs.readFile(path.join(currentTestFilesFolder, "query.graphql"))).toString();
          const response = graphql({
            schema,
            source: query,
            contextValue: createContext(readJsonFile(filesDir), ref, markerFile, rootFile),
          });
          return response;
        })
      );

      const result = await readJsonFile(currentTestFilesFolder)("result.json");

      // GraphQL errors doesn't map to json, so we have to fix it manually
      const errorMessages = responses
        .filter((r) => r.errors)
        .flatMap((r) => r.errors!.map((err) => ({ message: err.message })));
      const errors = errorMessages.length > 0 ? [{ errors: errorMessages }] : undefined;

      if (errors) {
        expect(errors).toEqual(result);
      } else {
        expect(responses).toEqual(result);
      }
    });
  }
});
