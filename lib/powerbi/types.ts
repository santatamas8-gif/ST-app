export type PowerBiErrorCode =
  | "not_configured"
  | "auth_failed"
  | "query_failed"
  | "timeout"
  | "invalid_response"
  | "network_error"
  | "invalid_query";

export type PowerBiSafeError = {
  code: PowerBiErrorCode;
  message: string;
};

/** One row from a DAX query result table (column name → cell value). */
export type PowerBiRow = Record<string, unknown>;

export type PowerBiTableResult = {
  rows: PowerBiRow[];
};

export type PowerBiQueryResult = {
  tables: PowerBiTableResult[];
};

export type ExecutePowerBiDaxQuerySuccess = {
  ok: true;
  results: PowerBiQueryResult[];
};

export type ExecutePowerBiDaxQueryFailure = {
  ok: false;
  error: PowerBiSafeError;
};

export type ExecutePowerBiDaxQueryResult =
  | ExecutePowerBiDaxQuerySuccess
  | ExecutePowerBiDaxQueryFailure;

export type ExecutePowerBiDaxQueryOptions = {
  /** Include null cells in row objects (Power BI serializerSettings). Default true. */
  includeNulls?: boolean;
  /** Override fetch timeout in ms. */
  timeoutMs?: number;
};

export type PowerBiConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
  datasetId: string;
};
