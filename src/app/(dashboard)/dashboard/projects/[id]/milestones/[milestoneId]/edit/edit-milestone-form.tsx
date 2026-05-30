"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormActions, FormRow } from "@/components/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MILESTONE_STATUS_OPTIONS } from "@/lib/status-colors";

import { updateMilestone } from "../../mutations";

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sequence: number;
  targetDate: string;
};

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function dateOnlyOrNull(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

export function EditMilestoneForm({
  projectId,
  milestone,
}: {
  projectId: string;
  milestone: Milestone;
}) {
  const router = useRouter();

  const [name, setName] = useState(milestone.name);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [status, setStatus] = useState(milestone.status);
  const [sequence, setSequence] = useState(String(milestone.sequence));
  const [targetDate, setTargetDate] = useState(milestone.targetDate);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const detailHref = `/dashboard/projects/${projectId}/milestones/${milestone.id}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Milestone name is required.");
      return;
    }
    const sequenceNum = Number.parseInt(sequence, 10);
    if (!Number.isFinite(sequenceNum) || sequenceNum < 1) {
      setError("Sequence must be a positive integer.");
      return;
    }

    setPending(true);
    const result = await updateMilestone({
      id: milestone.id,
      projectId,
      name,
      description: nullIfBlank(description),
      status,
      sequence: sequenceNum,
      targetDate: dateOnlyOrNull(targetDate),
    });

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.push(detailHref);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="name" label="Name" required>
        <Input
          id="name"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field id="description" label="Description" optional>
        <Textarea
          id="description"
          rows={3}
          disabled={pending}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <FormRow>
        <Field
          id="sequence"
          label="Sequence"
          required
          description="The order this milestone appears in the project."
        >
          <Input
            id="sequence"
            type="number"
            min={1}
            step={1}
            required
            disabled={pending}
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
          />
        </Field>
        <Field id="status" label="Status">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v ?? "not_started")}
            disabled={pending}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MILESTONE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormRow>

      <Field id="target_date" label="Target date" optional>
        <Input
          id="target_date"
          type="date"
          disabled={pending}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
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
