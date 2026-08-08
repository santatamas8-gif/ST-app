import { describe, expect, it } from "vitest";

import {
  escapeDaxString,
  parseIsoDateParts,
  pickRowValue,
  toNullableNumber,
} from "@/lib/powerbi/queries/rowUtils";

describe("powerbi rowUtils", () => {
  it("escapes DAX double quotes", () => {
    expect(escapeDaxString('O"Brien')).toBe('O""Brien');
  });

  it("picks bracketed and plain column keys", () => {
    expect(pickRowValue({ "[TD]": 1 }, "TD")).toBe(1);
    expect(pickRowValue({ TD: 2 }, "TD")).toBe(2);
    expect(pickRowValue({ "GPS_Log[TD]": 3 }, "TD")).toBe(3);
  });

  it("converts numeric-like values", () => {
    expect(toNullableNumber(12.5)).toBe(12.5);
    expect(toNullableNumber("3")).toBe(3);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber("x")).toBeNull();
  });

  it("parses ISO date prefixes", () => {
    expect(parseIsoDateParts("2026-08-07")).toEqual({
      year: 2026,
      month: 8,
      day: 7,
    });
    expect(parseIsoDateParts("2026-08-07T00:00:00")).toEqual({
      year: 2026,
      month: 8,
      day: 7,
    });
    expect(parseIsoDateParts("07/08/2026")).toBeNull();
  });
});
