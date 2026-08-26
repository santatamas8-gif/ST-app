import { describe, expect, it } from "vitest";

import { decideProfileRoleAction } from "@/lib/authRolePolicy";

describe("decideProfileRoleAction", () => {
  it("keeps an existing admin role and does not write", () => {
    expect(
      decideProfileRoleAction({
        role: "admin",
        profileExists: true,
        readFailed: false,
        isImmutableAdmin: true,
      })
    ).toEqual({ role: "admin", action: "none" });
  });

  it("restores immutable admin if the stored role was overwritten to player", () => {
    expect(
      decideProfileRoleAction({
        role: "player",
        profileExists: true,
        readFailed: false,
        isImmutableAdmin: true,
      })
    ).toEqual({ role: "admin", action: "restore-admin" });
  });

  it("does not write player over an existing staff or player profile when the read fails", () => {
    expect(
      decideProfileRoleAction({
        role: null,
        profileExists: false,
        readFailed: true,
        isImmutableAdmin: false,
      })
    ).toEqual({ role: "player", action: "none" });
  });

  it("inserts player only when no profile row exists", () => {
    expect(
      decideProfileRoleAction({
        role: null,
        profileExists: false,
        readFailed: false,
        isImmutableAdmin: false,
      })
    ).toEqual({ role: "player", action: "insert-player" });
  });

  it("never overwrites an existing player or staff role", () => {
    expect(
      decideProfileRoleAction({
        role: "staff",
        profileExists: true,
        readFailed: false,
        isImmutableAdmin: false,
      })
    ).toEqual({ role: "staff", action: "none" });
    expect(
      decideProfileRoleAction({
        role: "player",
        profileExists: true,
        readFailed: false,
        isImmutableAdmin: false,
      })
    ).toEqual({ role: "player", action: "none" });
  });

  it("treats a failed read for the immutable admin as restore, not player fallback", () => {
    expect(
      decideProfileRoleAction({
        role: null,
        profileExists: false,
        readFailed: true,
        isImmutableAdmin: true,
      })
    ).toEqual({ role: "admin", action: "restore-admin" });
  });
});
