import { redirect } from "next/navigation";

import { isClient } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { Sidebar } from "./sidebar";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // getCurrentRole is cache()-wrapped so nested per-section layouts that
  // call it again reuse this fetch — no extra round-trips.
  const role = await getCurrentRole();

  // Clients are not allowed inside the dashboard at all (v1). Bounce
  // them to a minimal placeholder route. The placeholder route is
  // OUTSIDE this layout, so it renders without nav.
  if (isClient(role)) {
    redirect("/portal");
  }

  const displayName =
    (user.user_metadata?.name as string | undefined) ?? user.email ?? "Account";

  return (
    <div className="flex min-h-svh items-start bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          Top utility strip — sticky to the top of the viewport so it
          stays visible while the dashboard scrolls. Sits below the
          sidebar in stacking order (z-10 < sidebar's z-20) which is
          fine: they don't horizontally overlap. Backdrop-blur softens
          long lists scrolling beneath.
        */}
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex items-center justify-end gap-4 px-8 py-3.5">
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1">
              <span
                aria-hidden
                className="size-2 rounded-full bg-green-500"
              />
              <span className="text-[13px] font-medium text-ink-900">
                {displayName}
              </span>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 px-8 py-10">{children}</main>
      </div>
    </div>
  );
}
