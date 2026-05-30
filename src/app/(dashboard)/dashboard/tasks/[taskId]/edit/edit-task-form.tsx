"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormActions, FormRow, FormSection } from "@/components/form";
import { updateTask } from "@/components/tasks/mutations";
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
import { userDisplay } from "@/lib/display";
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/status-colors";

type UserOption = { id: string; name: string | null; email: string };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  pmId: string | null;
  estimateHours: number | null;
  dueAt: string;
};

const UNASSIGNED = "__unassigned__";
const NO_PM = "__no_pm__";

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function numberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function dateToIsoOrNull(v: string): string | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

export function EditTaskForm({
  task,
  assignees,
  pmCandidates,
  detailHref,
}: {
  task: Task;
  assignees: UserOption[];
  pmCandidates: UserOption[];
  detailHref: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState<string>(
    task.assigneeId ?? UNASSIGNED
  );
  const [pmId, setPmId] = useState<string>(task.pmId ?? NO_PM);
  const [estimateHours, setEstimateHours] = useState(
    task.estimateHours != null ? String(task.estimateHours) : ""
  );
  const [dueAt, setDueAt] = useState(task.dueAt);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setPending(true);
    const result = await updateTask({
      id: task.id,
      title,
      description: nullIfBlank(description),
      status,
      priority,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
      pmId: pmId === NO_PM ? null : pmId,
      estimateHours: numberOrNull(estimateHours),
      dueAt: dateToIsoOrNull(dueAt),
    });

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.push(detailHref);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        <Field id="title" label="Title" required>
          <Input
            id="title"
            type="text"
            autoComplete="off"
            required
            disabled={pending}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          <Field id="priority" label="Priority">
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v ?? "medium")}
              disabled={pending}
            >
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormRow>

        <Field id="assignee_id" label="Assignee" optional>
          <Select
            value={assigneeId}
            onValueChange={(v) => setAssigneeId(v ?? UNASSIGNED)}
            disabled={pending || assignees.length === 0}
          >
            <SelectTrigger id="assignee_id" className="w-full">
              <SelectValue
                placeholder={
                  assignees.length === 0 ? "No users available" : "Unassigned"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
              {assignees.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {userDisplay(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="pm_id" label="PM (owner of this task)" optional>
          <Select
            value={pmId}
            onValueChange={(v) => setPmId(v ?? NO_PM)}
            disabled={pending || pmCandidates.length === 0}
          >
            <SelectTrigger id="pm_id" className="w-full">
              <SelectValue
                placeholder={
                  pmCandidates.length === 0 ? "No PMs available" : "Optional"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PM}>— None —</SelectItem>
              {pmCandidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {userDisplay(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <FormRow>
          <Field id="estimate_hours" label="Estimate (hours)" optional>
            <Input
              id="estimate_hours"
              type="number"
              min={0}
              step="0.25"
              disabled={pending}
              value={estimateHours}
              onChange={(e) => setEstimateHours(e.target.value)}
            />
          </Field>
          <Field id="due_at" label="Due date" optional>
            <Input
              id="due_at"
              type="date"
              disabled={pending}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </Field>
        </FormRow>
      </FormSection>

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
