"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Field } from "@/components/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signIn, initialState);

  // Fallback for any invite link sent before /auth/callback existed
  // (which dropped the user here with a Supabase token in the URL
  // fragment). Forward the hash to /auth/callback so the new flow can
  // pick up the session. No-op for normal logins.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token=") || hash.includes("error_description=")) {
      router.replace(`/auth/callback${hash}`);
    }
  }, [router]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="email" label="Email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@growwstacks.com"
          required
          disabled={pending}
        />
      </Field>

      <Field id="password" label="Password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </Field>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
