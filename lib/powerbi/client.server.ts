import "server-only";

/**
 * Public Power BI server connector for ST-AMS (GPS Load Planner and later planners).
 *
 * Import only from server code (Server Components, Route Handlers, server actions).
 * Never import this module from client components.
 *
 * Main API: `executePowerBiDaxQuery` — obtains a token (best-effort cache) and runs DAX
 * against the configured workspace/dataset. Access tokens are not exported.
 */

export { executePowerBiDaxQuery } from "@/lib/powerbi/executeQuery.server";

export type {
  ExecutePowerBiDaxQueryOptions,
  ExecutePowerBiDaxQueryResult,
  ExecutePowerBiDaxQuerySuccess,
  ExecutePowerBiDaxQueryFailure,
  PowerBiErrorCode,
  PowerBiSafeError,
  PowerBiQueryResult,
  PowerBiTableResult,
  PowerBiRow,
} from "@/lib/powerbi/types";
