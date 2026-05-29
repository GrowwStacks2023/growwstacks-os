"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { revokeApiKey } from "./actions";

export function RevokeKeyButton({ keyId }: { keyId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Revoke this API key? External integrations using it will start getting 401."
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await revokeApiKey(keyId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      {error ? (
        <span className="text-[12px] text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
