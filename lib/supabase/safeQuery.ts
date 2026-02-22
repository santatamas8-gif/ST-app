/**
 * Server-side only. Wraps Supabase (or any) queries in try/catch,
 * logs errors with area/code/message/details, and returns a safe error object to the UI.
 * Never throws raw Supabase errors to the client.
 */

export type SafeError = { code: string; message: string };

export async function runQuery<T>(
  area: string,
  fn: () => Promise<{ data: T; error?: { code?: string; message?: string } | null }>
): Promise<{ data: T | null; error: SafeError | null }> {
  try {
    const result = await fn();
    if (result.error) {
      const code = result.error.code ?? "unknown";
      const message = result.error.message ?? "Unknown error";
      console.error("[safeQuery]", { area, code, message, details: result.error });
      return { data: null, error: { code: String(code), message } };
    }
    return { data: result.data, error: null };
  } catch (e) {
    const err = e as Error;
    console.error("[safeQuery]", {
      area,
      code: "exception",
      message: err.message,
      details: err,
    });
    return {
      data: null,
      error: { code: "exception", message: err.message || "Unknown error" },
    };
  }
}
