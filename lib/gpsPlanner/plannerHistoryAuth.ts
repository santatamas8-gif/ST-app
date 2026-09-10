import { timingSafeEqual } from "node:crypto";

export const PLANNER_HISTORY_SCHEMA_VERSION = 1;

const USERNAME_ENV = "POWERBI_PLANNER_EXPORT_USERNAME";
const PASSWORD_ENV = "POWERBI_PLANNER_EXPORT_PASSWORD";

export type PlannerHistoryExportConfig =
  | { ok: true; username: string; password: string }
  | { ok: false };

export function readPlannerHistoryExportConfig(): PlannerHistoryExportConfig {
  const username = process.env[USERNAME_ENV];
  const password = process.env[PASSWORD_ENV];
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length === 0 ||
    password.length === 0
  ) {
    return { ok: false };
  }
  return { ok: true, username, password };
}

export function parseBasicAuthorizationHeader(
  header: string | null | undefined
): { username: string; password: string } | null {
  if (typeof header !== "string") return null;
  const match = /^Basic\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  return {
    username: decoded.slice(0, sep),
    password: decoded.slice(sep + 1),
  };
}

function secretEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function plannerHistoryCredentialsMatch(
  provided: { username: string; password: string },
  expected: { username: string; password: string }
): boolean {
  const userOk = secretEqual(provided.username, expected.username);
  const passOk = secretEqual(provided.password, expected.password);
  return userOk && passOk;
}
