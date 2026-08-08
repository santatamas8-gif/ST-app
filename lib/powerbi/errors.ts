import type { PowerBiErrorCode, PowerBiSafeError } from "@/lib/powerbi/types";

export function powerBiError(
  code: PowerBiErrorCode,
  message: string
): PowerBiSafeError {
  return { code, message };
}

/**
 * Log a Power BI failure without secrets, tokens, or env values.
 * `detail` should already be redacted / non-sensitive.
 */
export function logPowerBiError(
  area: string,
  error: { code: string; message: string },
  detail?: Record<string, unknown>
): void {
  console.error("[powerbi]", {
    area,
    code: error.code,
    message: error.message,
    ...(detail ? { detail } : {}),
  });
}

/** Map AbortError / timeout to a safe error. */
export function errorFromUnknown(
  area: string,
  err: unknown,
  fallbackCode: PowerBiErrorCode,
  fallbackMessage: string
): PowerBiSafeError {
  if (err instanceof Error && err.name === "AbortError") {
    const safe = powerBiError("timeout", "Power BI request timed out.");
    logPowerBiError(area, safe);
    return safe;
  }
  const safe = powerBiError(fallbackCode, fallbackMessage);
  logPowerBiError(area, safe, {
    name: err instanceof Error ? err.name : "unknown",
  });
  return safe;
}
