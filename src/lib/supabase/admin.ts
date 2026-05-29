import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// ─── SERVER ONLY ────────────────────────────────────────────────────────
// This module returns a Supabase client authenticated with the
// service-role key. It BYPASSES Row-Level Security entirely. Two callers
// in this codebase, both server-side:
//
//   1. src/app/(dashboard)/dashboard/users/actions.ts
//      — auth.admin.inviteUserByEmail / generateLink for inviting new
//        users and (post-create) updating their public.users row.
//   2. src/lib/api/* + src/app/api/v1/**
//      — public REST endpoints authenticated by API keys instead of
//        Supabase Auth. Since there is no auth.uid() for these callers,
//        RLS cannot gate them — the API-key check and scope are the
//        entire authorization layer.
//
// RULES:
//   - NEVER import this from a "use client" file. The bundler does not
//     statically prove that — caller discipline is what protects us.
//   - NEVER log the key or pass it into a third-party SDK that might log.
//   - NEVER expose the result in a Server-Action return value rendered
//     in a client component. Only use it to read/write Supabase, then
//     return plain data.
//   - Throw if the env var is missing rather than fall back to the
//     publishable key — silent degradation here would mean the admin
//     surface silently does nothing or, worse, runs under the user's
//     session.
// ───────────────────────────────────────────────────────────────────────

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Cannot build the admin client."
    );
  }
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local. " +
        "Without it, admin features (user invites, public API) are unavailable."
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      // No cookies, no session, no token refresh — this client never acts
      // on behalf of a user.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
