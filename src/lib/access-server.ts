import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { canAccess, type Role, type Section } from "./access";

// Server-only helper. Fetches the current user's role once per request
// (deduplicated by React's cache()), so the dashboard layout AND any
// nested per-section layout AND any page itself can all call this without
// hitting Postgres more than once.
//
// Returns null if the caller is unauthenticated OR has no row in
// public.users yet (the on_auth_user_created trigger should always create
// one, but be defensive). Callers treat null as "no access".
export const getCurrentRole = cache(async (): Promise<Role | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role ?? null;
});

// One-call section guard for per-section layouts. Pattern:
//   export default async function FooLayout({ children }) {
//     await guardSection("foo");
//     return <>{children}</>;
//   }
// The redirect target is /dashboard — every non-client role can render
// that page, so it's a safe landing spot. (Clients never reach here:
// the dashboard layout itself redirects them to /portal first.)
export async function guardSection(section: Section): Promise<void> {
  const role = await getCurrentRole();
  if (!canAccess(role, section)) {
    redirect("/dashboard");
  }
}
