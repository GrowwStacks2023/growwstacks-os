"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormActions } from "@/components/form";
import { updateOwnTaskStatus } from "@/components/tasks/mutations";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS_OPTIONS } from "@/lib/status-colors";

// Developer-only narrow edit form. Status dropdown + Save changes.
// Other fields are intentionally absent: per the matrix, developers can
// only flip status on a task assigned to them. The action does its own
// assignee check, but we never render anything else to begin with.
export function EditTaskStatusForm({
  taskId,
  currentStatus,
  detailHref,
}: {
  taskId: string;
  currentStatus: string;
  detailHref: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await updateOwnTaskStatus(taskId, status);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push(detailHref);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="status" label="Status">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v ?? "todo")}
          disabled={pending}
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href={detailHref} />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FormActions>
    </form>
  );
}
