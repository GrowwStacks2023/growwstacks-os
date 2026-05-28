"use client";

import Link from "next/link";
import { useActionState } from "react";

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

import { createMilestone, type CreateMilestoneState } from "./actions";

const initialState: CreateMilestoneState = { error: null };

export function NewMilestoneForm({
  projectId,
  nextSequence,
}: {
  projectId: string;
  nextSequence: number;
}) {
  // Bind projectId so the action stays a (state, formData) thunk.
  const boundAction = createMilestone.bind(null, projectId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="name" label="Name" required>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
        />
      </Field>

      <Field id="description" label="Description" optional>
        <Textarea
          id="description"
          name="description"
          rows={3}
          disabled={pending}
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
            name="sequence"
            type="number"
            min={1}
            step={1}
            defaultValue={nextSequence}
            required
            disabled={pending}
          />
        </Field>
        <Field id="status" label="Status">
          <Select name="status" defaultValue="not_started" disabled={pending}>
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
          name="target_date"
          type="date"
          disabled={pending}
        />
      </Field>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href={`/dashboard/projects/${projectId}`} />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create milestone"}
        </Button>
      </FormActions>
    </form>
  );
}
