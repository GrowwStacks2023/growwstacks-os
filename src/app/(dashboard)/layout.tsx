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
    <div className="flex min-h-svh bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          Top utility strip — kept small and low-contrast so the page
          title is what reads first. The hairline under it gives the
          page a top edge without a heavy admin-bar feel.
        */}
        <header className="border-b border-border/70 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-end gap-3 px-8 py-3">
            <span className="text-[12px] font-medium text-muted-foreground">
              {displayName}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 px-8 py-10">{children}</main>
      </div>
    </div>
  );
}
