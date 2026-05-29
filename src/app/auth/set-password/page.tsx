"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Field } from "@/components/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// /auth/set-password
//
// Two-step authentication: the user arrives here from /auth/callback
// after setSession has written their session into cookies. They pick a
// password, we call supabase.auth.updateUser({ password }), and they
// land on /dashboard.
//
// Bookmark / refresh defence: if there's no active session (e.g. they
// closed and reopened the tab and lost client memory), redirect them to
// /login with a friendly notice. The session itself is the proof they
// came from a valid invite link.

type SessionPhase =
  | { kind: "checking" }
  | { kind: "ready"; email: string }
  | { kind: "missing" }
  | { kind: "success" };

export default function SetPasswordPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPhase>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify the session set by /auth/callback is still here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (userError || !data.user) {
        setSession({ kind: "missing" });
        return;
      }
      setSession({ kind: "ready", email: data.user.email ?? "" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once we know there's no session, kick to login after a beat so the
  // user can read the notice.
  useEffect(() => {
    if (session.kind !== "missing") return;
    const t = setTimeout(
      () => router.replace("/login?notice=session_expired"),
      2500
    );
    return () => clearTimeout(t);
  }, [session.kind, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSession({ kind: "success" });
    // Brief "welcome" pause so the success state is visible, then push
    // into the workspace. The dashboard layout's getUser will already
    // see the session cookie set by /auth/callback's setSession call.
    setTimeout(() => router.replace("/dashboard"), 800);
  }

  return (
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

            {session.kind === "checking" ? (
              <>
                <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                  Loading…
                </h1>
                <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-500">
                  <span
                    aria-hidden
                    className="size-2 animate-pulse rounded-full bg-blue-600"
                  />
                  Checking your session…
                </div>
              </>
            ) : session.kind === "missing" ? (
              <>
                <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                  Session expired
                </h1>
                <p className="mt-2 text-[14px] text-ink-500">
                  Your invite link can only be used once and the session
                  doesn&apos;t appear to be active anymore. Sending you back to
                  login — ask the admin for a fresh invite if needed.
                </p>
              </>
            ) : session.kind === "success" ? (
              <>
                <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                  Password set ✓
                </h1>
                <p className="mt-2 text-[14px] text-ink-500">
                  Taking you into your workspace…
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                  Set your password
                </h1>
                <p className="mt-1.5 text-[14px] text-ink-500">
                  Welcome to GrowwStacks OS. Pick a password to finish setting
                  up your account
                  {session.email ? (
                    <>
                      {" "}for{" "}
                      <span className="font-semibold text-ink-900">
                        {session.email}
                      </span>
                    </>
                  ) : null}
                  .
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="mt-5 flex flex-col gap-4"
                >
                  <Field id="password" label="New password" required>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={submitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>

                  <Field id="confirm" label="Confirm password" required>
                    <Input
                      id="confirm"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={submitting}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </Field>

                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? "Setting password…" : "Set password"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
