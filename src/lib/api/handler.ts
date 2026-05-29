import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  authenticateApiRequest,
  requireWriteScope,
  type AuthSuccess,
} from "./auth";
import { extractRequestMeta, logApiRequest } from "./audit";

// ─── /api/v1 shared response shape ─────────────────────────────────────
//   Success: { data: T }
//   Error:   { error: string, code: string }
//
// Every handler returns through this wrapper so the audit log is written
// consistently (status + path captured AFTER the body resolves).

export type ApiContext = {
  auth: AuthSuccess;
  // Same admin client used everywhere downstream — bypasses RLS, since
  // the API key is the entire gate.
  supabase: ReturnType<typeof createAdminClient>;
};

type Handler<T> = (ctx: ApiContext, req: Request) => Promise<{
  status: number;
  body: { data: T } | { error: string; code: string };
}>;

async function respond(req: Request, fn: Handler<unknown>, requireWrite: boolean) {
  const meta = extractRequestMeta(req);
  const url = new URL(req.url);
  const path = url.pathname;

  const auth = await authenticateApiRequest(req);
  if (!auth.ok) {
    await logApiRequest({
      apiKeyId: null,
      method: req.method,
      path,
      status: auth.status,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (requireWrite) {
    const denied = requireWriteScope(auth);
    if (denied) {
      await logApiRequest({
        apiKeyId: auth.keyId,
        method: req.method,
        path,
        status: denied.status,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return NextResponse.json(denied.body, { status: denied.status });
    }
  }

  const supabase = createAdminClient();

  let result: { status: number; body: unknown };
  try {
    result = await fn({ auth, supabase }, req);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Internal error";
    result = {
      status: 500,
      body: { error: msg, code: "internal_error" },
    };
  }

  await logApiRequest({
    apiKeyId: auth.keyId,
    method: req.method,
    path,
    status: result.status,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json(result.body, { status: result.status });
}

// Public wrappers. Routes call `withRead(handler)` or `withWrite(handler)`.
export function withRead<T>(fn: Handler<T>) {
  return (req: Request) => respond(req, fn as Handler<unknown>, false);
}
export function withWrite<T>(fn: Handler<T>) {
  return (req: Request) => respond(req, fn as Handler<unknown>, true);
}

// Common helpers for parsing JSON bodies.
export async function readJsonBody<T = Record<string, unknown>>(
  req: Request
): Promise<T | { _bodyError: string }> {
  try {
    const body = (await req.json()) as T;
    if (body == null || typeof body !== "object") {
      return { _bodyError: "Body must be a JSON object." };
    }
    return body;
  } catch {
    return { _bodyError: "Invalid JSON body." };
  }
}

export function isBodyError<T>(
  v: T | { _bodyError: string }
): v is { _bodyError: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "_bodyError" in v &&
    typeof (v as { _bodyError: unknown })._bodyError === "string"
  );
}

export function badRequest(message: string) {
  return {
    status: 400 as const,
    body: { error: message, code: "bad_request" as const },
  };
}

export function notFound(message: string) {
  return {
    status: 404 as const,
    body: { error: message, code: "not_found" as const },
  };
}

export function dbError(message: string) {
  return {
    status: 500 as const,
    body: { error: message, code: "db_error" as const },
  };
}
