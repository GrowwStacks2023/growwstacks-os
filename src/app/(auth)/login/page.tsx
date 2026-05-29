import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    // Full-bleed animated gradient — defined as .login-bg in globals.css.
    // `overflow: hidden` is REQUIRED so the orbs that drift past the edges
    // don't cause the page to gain a horizontal scrollbar.
    <div className="login-bg relative isolate min-h-svh w-full overflow-hidden">
      {/*
        Soft-blur orbs — three of them, each with its own slow keyframe.
        Their durations (32s / 38s / 44s) never sync, so the motion stays
        organic. The whole shebang shuts off via prefers-reduced-motion in
        the stylesheet.
      */}
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

      {/* Card column. Centered, max-width keeps the form compact. */}
      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-[18px] border border-white/40 bg-white/95 px-7 py-8 shadow-[0_24px_60px_-20px_rgba(10,37,64,0.45),0_8px_24px_-12px_rgba(10,37,64,0.25)] backdrop-blur-sm sm:px-8 sm:py-9">
            {/* Brand block */}
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

            <div className="mb-6">
              <h1 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink-900">
                Sign in to continue
              </h1>
              <p className="mt-1.5 text-[14px] text-ink-500">
                Welcome back. Use your team credentials to enter the workspace.
              </p>
            </div>

            <LoginForm />

            <p className="mt-6 text-center text-[12px] text-ink-400">
              GrowwStacks · Internal v1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
