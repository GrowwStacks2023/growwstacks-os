import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

// Paths the deactivation gate should NEVER redirect away from. The user
// can still GET these — they're how we get them OUT.
const DEACTIVATION_BYPASS = [
  "/login",
  "/auth/callback",
  "/auth/set-password",
];

function isBypass(pathname: string): boolean {
  return DEACTIVATION_BYPASS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Touch the session so any refreshed tokens get written back to cookies
  // before the response is committed. Do not put logic between createServerClient
  // and getUser — see Supabase SSR docs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Deactivation gate. If the caller has a valid Supabase session but
  // their public.users row is is_active=false, sign them out and bounce
  // to /login with a notice. Bypassed for /login, /auth/callback, and
  // /auth/set-password so the user can still get OUT (and so freshly-
  // landing invitees don't accidentally trip on this before their
  // public.users row is fully realised).
  if (user && !isBypass(request.nextUrl.pathname)) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_active, deleted_at")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profile &&
      (profile.is_active === false || profile.deleted_at != null)
    ) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search =
        profile.deleted_at != null
          ? "?notice=account_deleted"
          : "?notice=account_deactivated";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
