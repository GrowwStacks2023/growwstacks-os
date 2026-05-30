"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

// ─── Key format ────────────────────────────────────────────────────────
// Plaintext keys look like: gks_<32 random base64url chars>.
//   gks_ = "growwstacks key" — identifies the issuer in logs / by sight.
//   32 base64url chars → ~24 bytes of entropy. More than enough for an
//   unguessable secret.
// We store ONLY the SHA-256 hex digest. The full plaintext is returned
// from generateApiKey ONCE and surfaced to the admin in the UI; the
// integrations list never sees it again.
//
// IMPORTANT: don't hash with a salt. Salts protect a hash table against
// rainbow lookups; for high-entropy random tokens like ours, raw SHA-256
// is fine and lets us do equality lookups efficiently. The /api/v1 auth
// path hashes the incoming bearer the same way and does WHERE key_hash = ?
// against a unique index — O(1) lookup, no per-row hashing cost.

const KEY_PREFIX_LITERAL = "gks_";
const RANDOM_BYTES = 24; // base64url-encodes to 32 chars
// First 12 visible chars after the "gks_" sentinel — enough to identify
// a key at a glance without leaking material entropy.
const PREFIX_VISIBLE_CHARS = 12;

function generatePlaintextKey(): string {
  return KEY_PREFIX_LITERAL + randomBytes(RANDOM_BYTES).toString("base64url");
}

function hashKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

const SCOPES = ["read", "read_write"] as const;
type Scope = (typeof SCOPES)[number];
function isScope(v: string): v is Scope {
  return (SCOPES as ReadonlyArray<string>).includes(v);
}

export type GenerateApiKeyResult =
  | {
      ok: true;
      // Returned ONCE. The admin must copy it now — it is not stored.
      fullKey: string;
      prefix: string;
      keyId: string;
    }
  | { ok: false; error: string };

export async function generateApiKey(
  name: string,
  scope: string,
  keyRole: string
): Promise<GenerateApiKeyResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, error: "Name is required." };
  }
  if (!isScope(scope)) {
    return { ok: false, error: "Scope must be read or read_write." };
  }
  // Only admin-role keys are issuable right now. The DB CHECK
  // constraint enforces it too — this is the friendlier early error.
  if (keyRole !== "admin") {
    return {
      ok: false,
      error: "Only admin-role API keys are supported in this version.",
    };
  }

  // Defense in depth: generate key + hash before going near the DB. If
  // anything fails after this point, we discard plaintext locally — it
  // never lands anywhere.
  const fullKey = generatePlaintextKey();
  const keyHash = hashKey(fullKey);
  const keyPrefix = fullKey.slice(
    0,
    KEY_PREFIX_LITERAL.length + PREFIX_VISIBLE_CHARS
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // Normal session client + RLS policies from 0016: admins only can INSERT.
  // We deliberately do NOT use the service-role client here — admins
  // creating keys go through the same auth gate as any other admin row.
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      name: trimmedName,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scope,
      role: "admin",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Plaintext stays in this function's stack — never logged.
    return {
      ok: false,
      error: error?.message ?? "Couldn't create the API key.",
    };
  }

  revalidatePath("/dashboard/integrations");

  return {
    ok: true,
    fullKey,
    prefix: keyPrefix,
    keyId: data.id,
  };
}

export type RevokeApiKeyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function revokeApiKey(
  keyId: string
): Promise<RevokeApiKeyResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }
  if (!keyId) return { ok: false, error: "Missing key id." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/integrations");
  return { ok: true };
}
