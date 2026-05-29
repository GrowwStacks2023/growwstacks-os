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
          Top utility strip — a clean white bar with a hairline rule,
          name + sign-out on the right. The page title is what reads
          first under it.
        */}
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-end gap-4 px-8 py-3.5">
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1">
              <span
                aria-hidden
                className="size-2 rounded-full bg-success-500"
              />
              <span className="text-[13px] font-medium text-foreground/85">
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
