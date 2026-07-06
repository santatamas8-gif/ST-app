import { describe, expect, it } from "vitest";
import {
  getExpectedPlayerInitials,
  normalizeInitialsText,
  verifyPlayerInitials,
} from "@/lib/kioskWellness/initials";

describe("getExpectedPlayerInitials", () => {
  it("uses first and last name part initials", () => {
    expect(getExpectedPlayerInitials("Santa Tamás")).toBe("st");
    expect(getExpectedPlayerInitials("John Paul Smith")).toBe("js");
  });

  it("is case and accent insensitive for verification", () => {
    expect(verifyPlayerInitials("Santa Tamás", "ST")).toBe(true);
    expect(verifyPlayerInitials("Santa Tamas", "st")).toBe(true);
  });

  it("uses first two letters for a single name part", () => {
    expect(getExpectedPlayerInitials("John")).toBe("jo");
    expect(verifyPlayerInitials("John", "JO")).toBe(true);
  });

  it("rejects wrong initials", () => {
    expect(verifyPlayerInitials("Santa Tamás", "ts")).toBe(false);
    expect(verifyPlayerInitials("Santa Tamás", "s")).toBe(false);
  });
});

describe("normalizeInitialsText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeInitialsText("Tamás")).toBe("tamas");
  });
});
