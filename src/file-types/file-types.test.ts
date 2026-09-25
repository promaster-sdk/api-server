import { describe, it, expect } from "vitest";
import { getBlobCell, getBlobHash } from "./file-types";

describe("getBlobHash", () => {
  it("tolerates both the raw hash and the { hash, mimeType } object", () => {
    expect(getBlobHash("abc")).toBe("abc");
    expect(getBlobHash({ hash: "abc", mimeType: "image/png" })).toBe("abc");
    expect(getBlobHash(null)).toBe(null);
  });
});

describe("getBlobCell", () => {
  it("tolerates both the raw hash and the { hash, mimeType } object", () => {
    expect(getBlobCell("abc")).toEqual({ hash: "abc", mimeType: null });
    expect(getBlobCell({ hash: "abc", mimeType: "image/png" })).toEqual({ hash: "abc", mimeType: "image/png" });
    expect(getBlobCell(null)).toBe(null);
  });
});
