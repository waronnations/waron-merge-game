import { describe, it, expect } from "vitest";
import { normalizeToken, addTokens, subTokens, shortenAddress } from "@/lib/tokens";

describe("normalizeToken", () => {
  it("rounds to 4 decimal places", () => {
    expect(normalizeToken(1.123456)).toBe(1.1235);
  });
  it("returns 0 for negative or non-finite values", () => {
    expect(normalizeToken(-5)).toBe(0);
    expect(normalizeToken(NaN)).toBe(0);
    expect(normalizeToken(Infinity)).toBe(0);
  });
});

describe("addTokens / subTokens", () => {
  it("adds and normalizes", () => {
    expect(addTokens(1.00005, 2.00005)).toBe(3.0001);
  });
  it("never goes below zero", () => {
    expect(subTokens(1, 5)).toBe(0);
  });
});

describe("shortenAddress", () => {
  it("shortens long addresses", () => {
    expect(shortenAddress("EQAmjezmAjiXZ7XfoLGQbNIm4CIEcQwM9CNbpTZJgcN9LeVi")).toBe("EQAm…LeVi");
  });
  it("leaves short addresses untouched", () => {
    expect(shortenAddress("abc")).toBe("abc");
  });
});
