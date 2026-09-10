import { NextResponse } from "next/server";

import {
  parseBasicAuthorizationHeader,
  plannerHistoryCredentialsMatch,
  readPlannerHistoryExportConfig,
} from "@/lib/gpsPlanner/plannerHistoryAuth";
import { loadPlannerHistoryExport } from "@/lib/gpsPlanner/plannerHistoryExport.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNAUTHORIZED_JSON = { error: "Authentication required." };
const UNAVAILABLE_JSON = { error: "Export is not configured." };
const LOAD_FAILED_JSON = { error: "Could not load planner history." };

function noStoreHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  return headers;
}

function unauthorized(): NextResponse {
  return NextResponse.json(UNAUTHORIZED_JSON, {
    status: 401,
    headers: noStoreHeaders({
      "WWW-Authenticate": 'Basic realm="ST-AMS Planner Export"',
    }),
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const config = readPlannerHistoryExportConfig();
  if (!config.ok) {
    return NextResponse.json(UNAVAILABLE_JSON, {
      status: 503,
      headers: noStoreHeaders(),
    });
  }

  const provided = parseBasicAuthorizationHeader(
    request.headers.get("authorization")
  );
  if (!provided || !plannerHistoryCredentialsMatch(provided, config)) {
    return unauthorized();
  }

  const loaded = await loadPlannerHistoryExport();
  if (!loaded.ok) {
    return NextResponse.json(LOAD_FAILED_JSON, {
      status: 500,
      headers: noStoreHeaders(),
    });
  }

  return NextResponse.json(loaded.data, {
    status: 200,
    headers: noStoreHeaders(),
  });
}
