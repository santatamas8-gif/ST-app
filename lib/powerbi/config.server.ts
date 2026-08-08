import "server-only";

import { POWERBI_ENV } from "@/lib/powerbi/constants";
import { powerBiError } from "@/lib/powerbi/errors";
import type { PowerBiConfig, PowerBiSafeError } from "@/lib/powerbi/types";

function readRequiredEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type PowerBiConfigResult =
  | { ok: true; config: PowerBiConfig }
  | { ok: false; error: PowerBiSafeError };

/**
 * Load Power BI server config from env.
 * Never returns secret values in error objects.
 */
export function getPowerBiConfig(): PowerBiConfigResult {
  const tenantId = readRequiredEnv(POWERBI_ENV.TENANT_ID);
  const clientId = readRequiredEnv(POWERBI_ENV.CLIENT_ID);
  const clientSecret = readRequiredEnv(POWERBI_ENV.CLIENT_SECRET);
  const workspaceId = readRequiredEnv(POWERBI_ENV.WORKSPACE_ID);
  const datasetId = readRequiredEnv(POWERBI_ENV.DATASET_ID);

  const missing: string[] = [];
  if (!tenantId) missing.push(POWERBI_ENV.TENANT_ID);
  if (!clientId) missing.push(POWERBI_ENV.CLIENT_ID);
  if (!clientSecret) missing.push(POWERBI_ENV.CLIENT_SECRET);
  if (!workspaceId) missing.push(POWERBI_ENV.WORKSPACE_ID);
  if (!datasetId) missing.push(POWERBI_ENV.DATASET_ID);

  if (missing.length > 0) {
    return {
      ok: false,
      error: powerBiError(
        "not_configured",
        `Power BI is not configured (missing: ${missing.join(", ")}).`
      ),
    };
  }

  return {
    ok: true,
    config: {
      tenantId: tenantId!,
      clientId: clientId!,
      clientSecret: clientSecret!,
      workspaceId: workspaceId!,
      datasetId: datasetId!,
    },
  };
}
