"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// /auth/callback
//
// The landing page for Supabase auth email links: invite, recovery, and
// magiclink. Supabase appends the tokens to the URL fragment
// (window.location.hash), NOT the search string, so this MUST be a
// client component — server components can't see the fragment.
//
// Flow:
//   1. Parse access_token, refresh_token, type from window.location.hash.
//   2. supabase.auth.setSession({ access_token, refresh_token }) →
//      writes the session into the @supabase/ssr cookie store. After
//      this returns, server-side getUser() calls (the dashboard layout,
//      etc.) will see the new user.
//   3. Redirect based on type:
//        invite/recovery → /auth/set-password (the user needs to pick
//                          their own password before they're set)
//        magiclink       → /dashboard (they're logged in, done)
//        anything else   → render an "invalid link" message with a
//                          link back to /login
//
// This route is public — the tokens in the hash ARE the authentication.

type Phase =
  | { kind: "verifying" }
  | { kind: "invalid"; reason: string };

export default function CallbackPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "verifying" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Fragment lives client-side only. URLSearchParams parses the
      // `key=val&key=val` shape Supabase appends.
      const fragment = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(fragment);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      const errorDescription = params.get("error_description");

      // Supabase sometimes redirects with #error=...&error_description=...
      // (e.g. expired link). Surface that directly.
      if (errorDescription) {
        if (!cancelled) {
          setPhase({ kind: "invalid", reason: errorDescription });
        }
        return;
      }

      if (!accessToken || !refreshToken) {
        if (!cancelled) {
          setPhase({
            kind: "invalid",
            reason:
              "This link is missing its access token. It may have been opened twice or copy/pasted incorrectly.",
          });
        }
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        if (!cancelled) {
          setPhase({
            kind: "invalid",
            reason:
              "This link has expired or is invalid. Ask the admin to re-invite you.",
          });
        }
        return;
      }

      // Session is set. Decide where to send them based on the link's
      // purpose. Hash stays in the URL during router.replace — clear it
      // by including a fresh URL.
      const target =
        type === "invite" || type === "recovery"
          ? "/auth/set-password"
          : type === "magiclink" || type === "signup"
            ? "/dashboard"
            : null;

      if (!target) {
        if (!cancelled) {
          setPhase({
            kind: "invalid",
            reason:
              "We don't recognise this link type. If the admin just invited you, ask them to resend.",
          });
        }
        return;
      }

      if (!cancelled) {
        // Replace, not push — the user shouldn't be able to back-button
        // into the consumed token URL.
        router.replace(target);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    // Same gradient + orbs as the login page so the user feels they're
    // still in the product, not bounced to a generic loading screen.
    <div className="login-bg relative isolate min-h-svh w-full overflow-hidden">
      <div
        aria-hidden
        className="login-orb login-orb--a top-[-120px] left-[-80px] size-[420px] sm:size-[520px]"
      />
      <div
        aria-hidden
        className="login-orb login-orb--b bottom-[-160px] right-[-100px] size-[460px] sm:size-[560px]"
      />
      <div
        aria-hidden
        className="login-orb login-orb--c top-[40%] left-[55%] size-[320px] sm:size-[400px]"
      />

      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-[18px] border border-white/40 bg-white/95 px-7 py-8 shadow-[0_24px_60px_-20px_rgba(10,37,64,0.45),0_8px_24px_-12px_rgba(10,37,64,0.25)] backdrop-blur-sm sm:px-8 sm:py-9">
            <div className="mb-6 flex items-center gap-3">
              <span
                aria-hidden
                className="brand-mark grid size-10 place-items-center rounded-[12px]"
              >
                <span className="font-display text-[20px] font-bold leading-none">
                  G
                </span>
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink-900">
                  GrowwStacks OS
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">
                  Operating System
                </span>
              </div>
            </div>

            {phase.kind === "verifying" ? (
              <>
                <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                  Verifying your invite…
                </h1>
                <p className="mt-2 text-[14px] text-ink-500">
                  This should only take a moment.
                </p>
                <div className="mt-6 flex items-center gap-2 text-[13px] text-ink-500">
                  <span
                    aria-hidden
                    className="size-2 animate-pulse rounded-full bg-blue-600"
                  />
                  Talking to Supabase…
                </div>
              </>
            ) : (
              <>
                <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                  Invalid link
                </h1>
                <p className="mt-2 text-[14px] text-ink-500">
                  We couldn&apos;t verify the link from your email.
                </p>
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{phase.reason}</AlertDescription>
                </Alert>
                <div className="mt-6 flex justify-end">
                  <Button render={<Link href="/login" />}>
                    Back to login
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
