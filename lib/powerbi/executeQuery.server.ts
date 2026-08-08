import "server-only";

import {
  POWERBI_QUERY_TIMEOUT_MS,
  powerBiExecuteQueriesUrl,
} from "@/lib/powerbi/constants";
import { getPowerBiAccessToken } from "@/lib/powerbi/auth.server";
import { getPowerBiConfig } from "@/lib/powerbi/config.server";
import {
  errorFromUnknown,
  logPowerBiError,
  powerBiError,
} from "@/lib/powerbi/errors";
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

/**
 * Execute a DAX query against the configured Power BI semantic model.
 * Prefer importing `executePowerBiDaxQuery` from `client.server.ts`.
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      powerBiExecuteQueriesUrl(workspaceId, datasetId),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queries: [{ query }],
          serializerSettings: { includeNulls },
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
      const error = powerBiError(
        "query_failed",
        "Power BI Execute Queries request failed."
      );
      logPowerBiError("executeQuery", error, { status: response.status });
      return { ok: false, error };
    }

    if (!json || !Array.isArray(json.results)) {
      const error = powerBiError(
        "invalid_response",
        "Power BI Execute Queries returned an unexpected payload."
      );
      logPowerBiError("executeQuery", error);
      return { ok: false, error };
    }

    return {
      ok: true,
      results: parseResults(json.results),
    };
  } catch (err) {
    return {
      ok: false,
      error: errorFromUnknown(
        "executeQuery",
        err,
        "network_error",
        "Power BI Execute Queries request failed."
      ),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
