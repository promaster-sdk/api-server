import { GraphQLObjectType, GraphQLString } from "graphql";
import { describe, it, expect } from "vitest";
import { buildTableRowTypeFields } from "./modules/shared-functions.js";
import { ProductTableFileColumn, ProductTableFileColumnType } from "../file-types/index.js";

const columns: ReadonlyArray<ProductTableFileColumn> = [{ type: ProductTableFileColumnType.Blob, name: "image" }];
const rows = [{ image: { hash: "aaa", mimeType: "image/png" } }, { image: "bbb" }, { image: null }];
const blobType = new GraphQLObjectType({ name: "Blob", fields: { hash: { type: GraphQLString } } });

function resolveImages(fields: ReturnType<typeof buildTableRowTypeFields>): ReadonlyArray<unknown> {
  // tslint:disable-next-line:no-any
  return rows.map((row) => fields["image"].resolve!(row as any, {}, {}, {} as any));
}

describe("GraphQL blob columns", () => {
  it("resolves the hash string by default, for both published blob cell types", () => {
    const fields = buildTableRowTypeFields(columns);
    expect(fields["image"].type).toBe(GraphQLString);
    expect(resolveImages(fields)).toEqual(["aaa", "bbb", null]);
  });

  it("resolves { hash, mimeType } objects with a blob type", () => {
    const fields = buildTableRowTypeFields(columns, blobType);
    expect(fields["image"].type).toBe(blobType);
    expect(resolveImages(fields)).toEqual([{ hash: "aaa", mimeType: "image/png" }, { hash: "bbb", mimeType: null }, null]);
  });
});
