import "server-only";

import {
  POWERBI_QUERY_MAX_RETRIES,
  POWERBI_QUERY_RETRY_BASE_DELAY_MS,
  POWERBI_QUERY_RETRY_MAX_DELAY_MS,
  POWERBI_QUERY_TIMEOUT_MS,
  powerBiExecuteQueriesUrl,
} from "@/lib/powerbi/constants";
import { getPowerBiAccessToken } from "@/lib/powerbi/auth.server";
import { getPowerBiConfig } from "@/lib/powerbi/config.server";
import { logPowerBiError, powerBiError } from "@/lib/powerbi/errors";
import type {
  ExecutePowerBiDaxQueryOptions,
  ExecutePowerBiDaxQueryResult,
  PowerBiQueryResult,
  PowerBiRow,
  PowerBiTableResult,
} from "@/lib/powerbi/types";

type RawExecuteQueriesResponse = {
  results?: unknown;
  error?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRows(rawRows: unknown): PowerBiRow[] {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.filter(isRecord) as PowerBiRow[];
}

function parseTables(rawTables: unknown): PowerBiTableResult[] {
  if (!Array.isArray(rawTables)) return [];
  return rawTables.map((table) => {
    if (!isRecord(table)) return { rows: [] };
    return { rows: parseRows(table.rows) };
  });
}

function parseResults(rawResults: unknown): PowerBiQueryResult[] {
  if (!Array.isArray(rawResults)) return [];
  return rawResults.map((result) => {
    if (!isRecord(result)) return { tables: [] };
    return { tables: parseTables(result.tables) };
  });
}

/** HTTP statuses treated as transient for bounded Execute Queries retry. */
export function isTransientPowerBiHttpStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(
      Math.round(asSeconds * 1000),
      POWERBI_QUERY_RETRY_MAX_DELAY_MS
    );
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    if (delta > 0) {
      return Math.min(delta, POWERBI_QUERY_RETRY_MAX_DELAY_MS);
    }
  }
  return null;
}

function backoffDelayMs(attemptIndex: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return retryAfterMs;
  const exp = POWERBI_QUERY_RETRY_BASE_DELAY_MS * 2 ** attemptIndex;
  return Math.min(exp, POWERBI_QUERY_RETRY_MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AttemptOutcome =
  | { kind: "success"; results: PowerBiQueryResult[] }
  | {
      kind: "retry";
      status?: number;
      retryAfterMs: number | null;
      errorCode: "query_failed" | "timeout" | "network_error";
      message: string;
    }
  | { kind: "fail"; result: ExecutePowerBiDaxQueryResult };

async function attemptExecuteQueries(input: {
  accessToken: string;
  workspaceId: string;
  datasetId: string;
  query: string;
  includeNulls: boolean;
  timeoutMs: number;
}): Promise<AttemptOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(
      powerBiExecuteQueriesUrl(input.workspaceId, input.datasetId),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queries: [{ query: input.query }],
          serializerSettings: { includeNulls: input.includeNulls },
        }),
        signal: controller.signal,
        cache: "no-store",
      }
    );

    let json: RawExecuteQueriesResponse | null = null;
    try {
      json = (await response.json()) as RawExecuteQueriesResponse;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
      if (isTransientPowerBiHttpStatus(response.status)) {
        return {
          kind: "retry",
          status: response.status,
          retryAfterMs,
          errorCode: "query_failed",
          message: "Power BI Execute Queries request failed.",
        };
      }
      const error = powerBiError(
        "query_failed",
        "Power BI Execute Queries request failed."
      );
      logPowerBiError("executeQuery", error, { status: response.status });
      return { kind: "fail", result: { ok: false, error } };
    }

    if (!json || !Array.isArray(json.results)) {
      const error = powerBiError(
        "invalid_response",
        "Power BI Execute Queries returned an unexpected payload."
      );
      logPowerBiError("executeQuery", error);
      return { kind: "fail", result: { ok: false, error } };
    }

    return { kind: "success", results: parseResults(json.results) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        kind: "retry",
        retryAfterMs: null,
        errorCode: "timeout",
        message: "Power BI request timed out.",
      };
    }
    return {
      kind: "retry",
      retryAfterMs: null,
      errorCode: "network_error",
      message: "Power BI Execute Queries request failed.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Execute a DAX query against the configured Power BI semantic model.
 * Prefer importing `executePowerBiDaxQuery` from `client.server.ts`.
 *
 * Transient HTTP 429 / 5xx, timeout, and network failures retry up to
 * {@link POWERBI_QUERY_MAX_RETRIES} times with short backoff (Retry-After respected).
 * Valid empty results, auth/config failures, and malformed success payloads do not retry.
 */
export async function executePowerBiDaxQuery(
  dax: string,
  options?: ExecutePowerBiDaxQueryOptions
): Promise<ExecutePowerBiDaxQueryResult> {
  const query = typeof dax === "string" ? dax.trim() : "";
  if (!query) {
    const error = powerBiError("invalid_query", "DAX query must be a non-empty string.");
    logPowerBiError("executeQuery", error);
    return { ok: false, error };
  }

  const configResult = getPowerBiConfig();
  if (!configResult.ok) {
    logPowerBiError("executeQuery", configResult.error);
    return { ok: false, error: configResult.error };
  }

  const tokenResult = await getPowerBiAccessToken();
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }

  const timeoutMs = options?.timeoutMs ?? POWERBI_QUERY_TIMEOUT_MS;
  const includeNulls = options?.includeNulls ?? true;
  const { workspaceId, datasetId } = configResult.config;
  const maxAttempts = 1 + POWERBI_QUERY_MAX_RETRIES;

  let lastRetry: Extract<AttemptOutcome, { kind: "retry" }> | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const outcome = await attemptExecuteQueries({
      accessToken: tokenResult.accessToken,
      workspaceId,
      datasetId,
      query,
      includeNulls,
      timeoutMs,
    });

    if (outcome.kind === "success") {
      return { ok: true, results: outcome.results };
    }
    if (outcome.kind === "fail") {
      return outcome.result;
    }

    lastRetry = outcome;
    const isLast = attempt >= maxAttempts - 1;
    if (isLast) break;

    const delay = backoffDelayMs(attempt, outcome.retryAfterMs);
    await sleep(delay);
  }

  const error = powerBiError(
    lastRetry?.errorCode ?? "query_failed",
    lastRetry?.message ?? "Power BI Execute Queries request failed."
  );
  logPowerBiError("executeQuery", error, {
    status: lastRetry?.status,
    attempts: maxAttempts,
  });
  return { ok: false, error };
}
