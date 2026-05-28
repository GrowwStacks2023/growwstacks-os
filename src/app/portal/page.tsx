import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// Minimal placeholder shown to client-role users. The dashboard layout
// redirects them here so they never land on an empty internal dashboard
// or hit a data route they can't read.
//
// No nav, no sidebar, no protected data. Just a friendly message and a
// sign-out button (re-implemented inline so we don't drag in the
// authenticated dashboard chrome).
export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle className="text-base">Your client portal is coming soon</CardTitle>
          <CardDescription>
            We&apos;re building the project-status view for clients. Until it
            ships, your account doesn&apos;t have anything to show here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user?.email ? (
            <p className="text-xs text-muted-foreground">
              Signed in as {user.email}
            </p>
          ) : null}
          <form
            action={async () => {
              "use server";
              const s = await createClient();
              await s.auth.signOut();
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
            <Button
              type="button"
              variant="link"
              render={<Link href="/" />}
              className="ml-2"
            >
              Back to home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
