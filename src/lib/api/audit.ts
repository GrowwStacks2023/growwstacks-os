import { createAdminClient } from "@/lib/supabase/admin";

// Append a row to api_audit_log. Non-fatal — never block the request on
// audit failure. Called once per /api/v1/* request (both for success and
// failure), after the response status is known.
//
// RLS on api_audit_log permits SELECT for admins only and no INSERT
// policy exists, so the service-role client is the ONLY way the table
// gets written to.
export async function logApiRequest(args: {
  apiKeyId: string | null;
  method: string;
  path: string;
  status: number;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("api_audit_log").insert({
      api_key_id: args.apiKeyId,
      method: args.method,
      path: args.path,
      status: args.status,
      ip: args.ip,
      user_agent: args.userAgent,
    });
  } catch {
    // Swallow — the request itself shouldn't fail because we couldn't
    // log it.
  }
}

// Pulls best-effort IP + user agent from headers. Behind Vercel/Cloudflare
// the real client IP lives in x-forwarded-for or cf-connecting-ip.
export function extractRequestMeta(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const fwd = req.headers.get("x-forwarded-for");
  const cf = req.headers.get("cf-connecting-ip");
  // x-forwarded-for can be a comma list; first entry is the client.
  const ip = cf ?? (fwd ? fwd.split(",")[0]!.trim() : null);
  const userAgent = req.headers.get("user-agent");
  return { ip, userAgent };
}
