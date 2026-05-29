"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  commitStagedAttachments,
  StagedAttachments,
  type StagedItem,
} from "@/components/attachments/staged";
import { Field, FormActions, FormRow, FormSection } from "@/components/form";
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

import { createTaskDirect, type TaskContext } from "./actions";

type UserOption = { id: string; name: string | null; email: string };
type ContactOption = {
  id: string;
  name: string;
  companyName: string | null;
};

// The form accepts either a fixed TaskContext (the deal/milestone/contact-
// detail-page entry points) or a "pickContact" mode where the user picks
// a contact inside the form itself (the standalone /dashboard/tasks/new
// route). In pickContact mode, we build a {kind: "contact", contactId}
// TaskContext at submit time from the picked contact.
export type NewTaskFormContext =
  | TaskContext
  | { kind: "pickContact"; contacts: ContactOption[] };

const UNASSIGNED = "__unassigned__";
const NO_PM = "__no_pm__";
const NO_CONTACT = "";

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function dateToIsoOrNull(v: string): string | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

function numberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function NewTaskForm({
  context,
  assignees,
  cancelHref,
  // PM is only meaningfully selectable for standalone tasks. For milestone
  // tasks the project's PM is the implicit owner, so the field is hidden.
  pmCandidates,
  // Optional default for assignee (used when "Add task" on a contact wants
  // to suggest the current user, but we leave that to callers).
  defaultAssigneeId,
  // Optional default for pm — when admin adds a standalone task and wants
  // it filed under themselves.
  defaultPmId,
}: {
  context: NewTaskFormContext;
  assignees: UserOption[];
  cancelHref: string;
  pmCandidates?: UserOption[];
  defaultAssigneeId?: string | null;
  defaultPmId?: string | null;
}) {
  const router = useRouter();
  const isPickContact = context.kind === "pickContact";
  // PM field shows for any non-milestone path (deal, contact, pickContact).
  const showPmField = context.kind !== "milestone";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string>(
    defaultAssigneeId ?? UNASSIGNED
  );
  const [pmId, setPmId] = useState<string>(defaultPmId ?? NO_PM);
  const [estimateHours, setEstimateHours] = useState("");
  const [dueAt, setDueAt] = useState("");
  // Standalone (pickContact) path only. Empty string = nothing picked yet.
  const [pickedContactId, setPickedContactId] = useState<string>(NO_CONTACT);

  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [partial, setPartial] = useState<{
    taskId: string;
    failures: { name: string; reason: string }[];
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    let resolvedContext: TaskContext;
    if (isPickContact) {
      if (!pickedContactId) {
        setError("Please pick a contact for this task.");
        return;
      }
      resolvedContext = { kind: "contact", contactId: pickedContactId };
    } else {
      // Narrow: anything that isn't `pickContact` is already a TaskContext.
      resolvedContext = context as TaskContext;
    }

    setPending(true);

    const result = await createTaskDirect({
      context: resolvedContext,
      title,
      description: nullIfBlank(description),
      status,
      priority,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
      // pm_id only when the field is shown; milestone tasks always get null
      // (the project PM is the owner via the project row).
      pmId: showPmField && pmId !== NO_PM ? pmId : null,
      estimateHours: numberOrNull(estimateHours),
      dueAt: dateToIsoOrNull(dueAt),
    });

    if (result.error || !result.taskId) {
      setPending(false);
      setError(result.error ?? "Couldn't create the task.");
      return;
    }

    const taskId = result.taskId;
    // The universal task detail route handles all three context shapes, so
    // post-create we always land there. Cancel goes back to the originating
    // page (passed in as cancelHref).
    const detailHref = `/dashboard/tasks/${taskId}`;

    if (staged.length === 0) {
      router.push(detailHref);
      return;
    }

    const commit = await commitStagedAttachments("task", taskId, staged);

    if (commit.failed.length === 0) {
      router.push(detailHref);
      return;
    }

    setPending(false);
    setPartial({
      taskId,
      failures: commit.failed.map((f) => ({
        name:
          f.item.kind === "file"
            ? f.item.label || f.item.file.name
            : f.item.label || f.item.url,
        reason: f.reason,
      })),
    });
  }

  if (partial) {
    const detailHref = `/dashboard/tasks/${partial.taskId}`;
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Task created, but {partial.failures.length} attachment
            {partial.failures.length === 1 ? "" : "s"} failed:
            <ul className="mt-2 list-disc pl-5 text-sm">
              {partial.failures.map((f, i) => (
                <li key={i}>
                  <span className="font-medium">{f.name}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button render={<Link href={detailHref} />}>Continue to task</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        {/*
          Standalone path: render the mandatory contact picker above the
          title. The picked contact becomes the task's contact_id (the
          createTaskDirect kind:"contact" path). Other entry points
          (milestone/deal/contact-detail) already know their context, so
          this picker is hidden.
        */}
        {isPickContact ? (
          <Field id="contact_id" label="Contact" required>
            <Select
              value={pickedContactId}
              onValueChange={(v) => setPickedContactId(v ?? NO_CONTACT)}
              disabled={
                pending || (context.kind === "pickContact"
                  ? context.contacts.length === 0
                  : true)
              }
            >
              <SelectTrigger id="contact_id" className="w-full">
                <SelectValue placeholder="Select a contact" />
              </SelectTrigger>
              <SelectContent>
                {context.kind === "pickContact"
                  ? context.contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName
                          ? `${c.name} (${c.companyName})`
                          : c.name}
                      </SelectItem>
                    ))
                  : null}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

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

        {showPmField ? (
          <Field
            id="pm_id"
            label="PM (owner of this task)"
            optional
            description="Required for non-admin PMs to own a standalone task (RLS uses this as the access grant)."
          >
            <Select
              value={pmId}
              onValueChange={(v) => setPmId(v ?? NO_PM)}
              disabled={pending || (pmCandidates ?? []).length === 0}
            >
              <SelectTrigger id="pm_id" className="w-full">
                <SelectValue
                  placeholder={
                    (pmCandidates ?? []).length === 0
                      ? "No PMs available"
                      : "Optional"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PM}>— None —</SelectItem>
                {(pmCandidates ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {userDisplay(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

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

      <StagedAttachments
        items={staged}
        onChange={setStaged}
        disabled={pending}
      />

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
          render={<Link href={cancelHref} />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create task"}
        </Button>
      </FormActions>
    </form>
  );
}
