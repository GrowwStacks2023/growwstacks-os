"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { resendInvite } from "./actions";

// Per-row ghost button. On click, calls the resendInvite server action;
// if the server returns an action_link, we surface it inline so the
// admin can copy and forward it manually (in case the project's email
// delivery isn't fully configured).
export function ResendInviteButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          setLink(null);
          setSent(false);
          startTransition(async () => {
            const result = await resendInvite(userId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSent(true);
            setLink(result.actionLink);
          });
        }}
      >
        {pending ? "Sending…" : sent ? "Sent ✓" : "Resend invite"}
      </Button>
      {error ? (
        <span className="text-[12px] text-red-600">{error}</span>
      ) : null}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[260px] truncate text-[12px] text-blue-700 hover:underline"
          title="Copy this link and forward to the user manually if needed"
        >
          {link}
        </a>
      ) : null}
    </div>
  );
}
