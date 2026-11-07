import "server-only";

import https from "node:https";
import { URL } from "node:url";

import {
  POWERBI_API_SCOPE,
  POWERBI_TOKEN_EXPIRY_SKEW_MS,
  POWERBI_TOKEN_TIMEOUT_MS,
  powerBiTokenUrl,
} from "@/lib/powerbi/constants";
import { getPowerBiConfig } from "@/lib/powerbi/config.server";
import {
  errorFromUnknown,
  logPowerBiError,
  powerBiError,
} from "@/lib/powerbi/errors";
import type { PowerBiConfig, PowerBiSafeError } from "@/lib/powerbi/types";

type CachedToken = {
  accessToken: string;
  /** Epoch ms when the cached token should be treated as expired. */
  expiresAtMs: number;
};

/** Best-effort in-memory cache (may be empty on each serverless instance). */
let tokenCache: CachedToken | null = null;

type TokenSuccess = { ok: true; accessToken: string };
type TokenFailure = { ok: false; error: PowerBiSafeError };
export type PowerBiAccessTokenResult = TokenSuccess | TokenFailure;

function readCachedToken(): string | null {
  if (!tokenCache) return null;
  if (Date.now() >= tokenCache.expiresAtMs) {
    tokenCache = null;
    return null;
  }
  return tokenCache.accessToken;
}

/** Drop the in-memory token so the next request asks Entra again. */
export function invalidatePowerBiAccessToken(): void {
  tokenCache = null;
}

function jwtExpiryMs(accessToken: string): number | null {
  const segment = accessToken.split(".")[1];
  if (!segment) return null;
  try {
    const json = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof json.exp === "number" && Number.isFinite(json.exp) ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function storeCachedToken(accessToken: string, expiresInSeconds: number): void {
  const byLifetime = Date.now() + Math.max(0, expiresInSeconds * 1000 - POWERBI_TOKEN_EXPIRY_SKEW_MS);
  const expiryMs = jwtExpiryMs(accessToken);
  const byClaim = expiryMs === null ? byLifetime : expiryMs - POWERBI_TOKEN_EXPIRY_SKEW_MS;
  const expiresAtMs = Math.min(byLifetime, byClaim);
  if (expiresAtMs <= Date.now()) return;
  tokenCache = { accessToken, expiresAtMs };
}

function postForm(urlString: string, body: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method: "POST",
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "Cache-Control": "no-cache",
        },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    request.on("error", reject);
    request.on("timeout", () => {
      const error = new Error("timeout");
      error.name = "AbortError";
      request.destroy(error);
    });
    request.write(body);
    request.end();
  });
}

async function fetchClientCredentialsToken(
  config: PowerBiConfig
): Promise<PowerBiAccessTokenResult> {
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: POWERBI_API_SCOPE,
    });

    const response = await postForm(powerBiTokenUrl(config.tenantId), body.toString(), POWERBI_TOKEN_TIMEOUT_MS);

    if (response.status < 200 || response.status >= 300) {
      const safe = powerBiError(
        "auth_failed",
        "Failed to obtain Power BI access token."
      );
      logPowerBiError("auth", safe, { status: response.status });
      return { ok: false, error: safe };
    }

    let json: unknown;
    try {
      json = JSON.parse(response.text);
    } catch {
      const safe = powerBiError(
        "invalid_response",
        "Power BI token response was not valid JSON."
      );
      logPowerBiError("auth", safe);
      return { ok: false, error: safe };
    }

    if (
      typeof json !== "object" ||
      json === null ||
      typeof (json as { access_token?: unknown }).access_token !== "string" ||
      !(json as { access_token: string }).access_token
    ) {
      const safe = powerBiError(
        "invalid_response",
        "Power BI token response did not include an access token."
      );
      logPowerBiError("auth", safe);
      return { ok: false, error: safe };
    }

    const accessToken = (json as { access_token: string }).access_token;
    const expiresInRaw = (json as { expires_in?: unknown }).expires_in;
    const expiresIn =
      typeof expiresInRaw === "number" && Number.isFinite(expiresInRaw)
        ? expiresInRaw
        : typeof expiresInRaw === "string" && /^\d+$/.test(expiresInRaw)
          ? Number(expiresInRaw)
          : 3600;

    storeCachedToken(accessToken, expiresIn);
    return { ok: true, accessToken };
  } catch (err) {
    return {
      ok: false,
      error: errorFromUnknown(
        "auth",
        err,
        "network_error",
        "Power BI token request failed."
      ),
    };
  }
}

/**
 * Obtain an Entra access token for the Power BI API (client_credentials).
 * Internal to the Power BI connector — do not call from outside lib/powerbi.
 */
export async function getPowerBiAccessToken(): Promise<PowerBiAccessTokenResult> {
  const cached = readCachedToken();
  if (cached) {
    return { ok: true, accessToken: cached };
  }

  const configResult = getPowerBiConfig();
  if (!configResult.ok) {
    logPowerBiError("auth", configResult.error);
    return { ok: false, error: configResult.error };
  }

  return fetchClientCredentialsToken(configResult.config);
}
