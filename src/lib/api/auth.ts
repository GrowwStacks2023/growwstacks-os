import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

// ─── /api/v1/* authentication ──────────────────────────────────────────
// The public API is gated by API keys, NOT by Supabase auth sessions.
// Incoming HTTP requests have no auth.uid(), so Postgres RLS cannot
// enforce anything on these calls. The flow:
//
//   1. Read the bearer key from `Authorization: Bearer <key>` or
//      `X-API-Key: <key>` (Postman-style fallback).
//   2. SHA-256 the bearer. Look up an active row in api_keys with the
//      matching hash. We use the SERVICE-ROLE client for this lookup
//      because (a) the request has no Supabase session, and (b) the
//      api_keys table's RLS is admin-only, which would otherwise block
//      the read.
//   3. If not found / revoked → return { ok: false, status: 401 }.
//   4. If found, bump last_used_at (non-fatal — don't block on it).
//   5. Return { ok: true, keyId, scope } to the route handler.
//
// The route handler then does the scope check: read-only keys can only
// GET; read_write can GET + POST. After that, the SERVICE-ROLE client
// is used for DB access — the API key is the entire authorization
// boundary, and RLS does not apply.
//
// SECURITY IMPLICATIONS:
//   - A leaked key has the access rights of its scope until revoked.
//   - We log every request to api_audit_log so admin can see exactly
//     what a key did over time (via Supabase Studio for now).
//   - The service-role client bypasses RLS for every /api/v1 call.
//     Treat the auth + scope checks here as the entire defence.

export type AuthSuccess = {
  ok: true;
  keyId: string;
  scope: "read" | "read_write";
};

export type AuthFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
  code: string;
  // Returned so the route handler can still log the failed attempt.
  keyId: null;
};

export type AuthResult = AuthSuccess | AuthFailure;

function extractKey(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return m[1].trim();
  }
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

function hashKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export async function authenticateApiRequest(
  req: Request
): Promise<AuthResult> {
  const plain = extractKey(req);
  if (!plain) {
    return {
      ok: false,
      status: 401,
      error: "Missing Authorization header.",
      code: "missing_key",
      keyId: null,
    };
  }

  const admin = createAdminClient();
  const keyHash = hashKey(plain);

  const { data, error } = await admin
    .from("api_keys")
    .select("id, scope, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      status: 401,
      error: "Invalid API key.",
      code: "invalid_key",
      keyId: null,
    };
  }

  if (data.revoked_at != null) {
    return {
      ok: false,
      status: 401,
      error: "API key revoked.",
      code: "revoked_key",
      keyId: null,
    };
  }

  // Bump last_used_at, non-fatal.
  await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined, () => undefined);

  return {
    ok: true,
    keyId: data.id,
    scope: data.scope as "read" | "read_write",
  };
}

// Helper used by route handlers to check the scope after auth succeeded.
// Returns null on success, or a failure object the handler should return.
export function requireWriteScope(
  auth: AuthSuccess
): { status: 403; body: { error: string; code: string } } | null {
  if (auth.scope === "read_write") return null;
  return {
    status: 403,
    body: {
      error: "This key has read scope; POST requires read_write.",
      code: "insufficient_scope",
    },
  };
}
