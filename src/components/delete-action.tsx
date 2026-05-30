"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Reusable confirm-then-delete control for any entity. Caller supplies
// the destructive label, the body copy, the action function, and (where
// applicable) a redirect path on success. Errors render inline inside
// the dialog so the user gets feedback without losing context.
//
// Pattern: every destructive action in Task 26 uses this. The dialog
// matches the spec design (white surface, --line border, --shadow-md
// elevation) via the AlertDialog primitive.
export function DeleteAction({
  triggerLabel = "Delete",
  triggerVariant = "destructive",
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  redirectTo,
  disabled = false,
}: {
  triggerLabel?: string;
  triggerVariant?: "destructive" | "outline" | "ghost";
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<{ ok: true } | { ok: false; error: string }>;
  // When set, push to this path after a successful delete. Use for
  // detail pages — back up to the parent list.
  redirectTo?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          if (!next) setError(null);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant={triggerVariant} size="sm" disabled={disabled}>
            {triggerLabel}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await onConfirm();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                if (redirectTo) {
                  router.push(redirectTo);
                } else {
                  router.refresh();
                }
              });
            }}
          >
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
