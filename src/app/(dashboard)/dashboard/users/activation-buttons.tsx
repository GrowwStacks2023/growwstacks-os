"use client";

import { useState, useTransition } from "react";

import { DeleteAction } from "@/components/delete-action";
import { Button } from "@/components/ui/button";

import { deactivateUser, deleteUser, reactivateUser } from "./actions";

export function DeactivateButton({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string;
}) {
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
              `Deactivate ${userLabel}? They will be signed out and unable to sign in again. ` +
                `Their assigned tasks will remain visible to admins.`
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deactivateUser(userId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {pending ? "Deactivating…" : "Deactivate"}
      </Button>
      {error ? (
        <span className="text-[12px] text-red-600">{error}</span>
      ) : null}
    </div>
  );
}

export function ReactivateButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await reactivateUser(userId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {pending ? "Reactivating…" : "Reactivate"}
      </Button>
      {error ? (
        <span className="text-[12px] text-red-600">{error}</span>
      ) : null}
    </div>
  );
}

// Hard-delete (tombstone). See server-action comment in actions.ts for
// the tombstone mechanism. The confirmation copy is intentionally
// strong — there's no undo.
export function DeleteUserButton({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string;
}) {
  return (
    <DeleteAction
      triggerLabel="Delete"
      title={`Delete ${userLabel}?`}
      description={
        <>
          This will permanently delete <strong>{userLabel}</strong>. Their
          work history on tasks, projects, and payments will be preserved
          (they&apos;ll appear as &quot;Former&quot; on those rows), but they
          cannot be reactivated. To bring them back, you&apos;ll need to
          re-invite them as a fresh user.
        </>
      }
      onConfirm={async () => deleteUser(userId)}
    />
  );
}
