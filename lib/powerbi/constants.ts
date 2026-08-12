/** Env var names and Microsoft API constants. Values come from process.env at runtime. */

export const POWERBI_ENV = {
  TENANT_ID: "POWERBI_TENANT_ID",
  CLIENT_ID: "POWERBI_CLIENT_ID",
  CLIENT_SECRET: "POWERBI_CLIENT_SECRET",
  WORKSPACE_ID: "POWERBI_WORKSPACE_ID",
  DATASET_ID: "POWERBI_DATASET_ID",
} as const;

export const POWERBI_API_SCOPE =
  "https://analysis.windows.net/powerbi/api/.default";

export const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

/** Token request timeout (ms). */
export const POWERBI_TOKEN_TIMEOUT_MS = 15_000;

/** Execute Queries request timeout (ms). */
export const POWERBI_QUERY_TIMEOUT_MS = 30_000;

/**
 * Max retries after the initial Execute Queries attempt for transient failures.
 * Total attempts = 1 + this value.
 */
export const POWERBI_QUERY_MAX_RETRIES = 2;

/** Base backoff (ms) before first retry; doubles each subsequent retry. */
export const POWERBI_QUERY_RETRY_BASE_DELAY_MS = 250;

/** Cap for Retry-After / backoff wait (ms). */
export const POWERBI_QUERY_RETRY_MAX_DELAY_MS = 5_000;

/** Refresh token this many ms before expiry (best-effort cache). */
export const POWERBI_TOKEN_EXPIRY_SKEW_MS = 120_000;

export function powerBiTokenUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
}

export function powerBiExecuteQueriesUrl(
  workspaceId: string,
  datasetId: string
): string {
  return `${POWERBI_API_BASE}/groups/${encodeURIComponent(workspaceId)}/datasets/${encodeURIComponent(datasetId)}/executeQueries`;
}
