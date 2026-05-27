"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { signOut } from "../(auth)/login/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
