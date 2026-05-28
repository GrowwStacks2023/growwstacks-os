"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  commitStagedAttachments,
  StagedAttachments,
  type StagedItem,
} from "@/components/attachments/staged";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/status-colors";

import { createTaskDirect } from "./actions";

type UserOption = { id: string; name: string | null; email: string };

const UNASSIGNED = "__unassigned__";

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
  projectId,
  milestoneId,
  assignees,
}: {
  projectId: string;
  milestoneId: string;
  assignees: UserOption[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);
  const [estimateHours, setEstimateHours] = useState("");
  const [dueAt, setDueAt] = useState("");

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

    setPending(true);

    const result = await createTaskDirect({
      projectId,
      milestoneId,
      title,
      description: nullIfBlank(description),
      status,
      priority,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
      estimateHours: numberOrNull(estimateHours),
      dueAt: dateToIsoOrNull(dueAt),
    });

    if (result.error || !result.taskId) {
      setPending(false);
      setError(result.error ?? "Couldn't create the task.");
      return;
    }

    const taskId = result.taskId;
    const detailHref = `/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/${taskId}`;

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
    const detailHref = `/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/${partial.taskId}`;
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          disabled={pending}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "todo")} disabled={pending}>
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
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">Priority</Label>
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
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="assignee_id">Assignee</Label>
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
                {u.name ?? u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="estimate_hours">Estimate (hours)</Label>
          <Input
            id="estimate_hours"
            type="number"
            min={0}
            step="0.25"
            disabled={pending}
            value={estimateHours}
            onChange={(e) => setEstimateHours(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="due_at">Due date</Label>
          <Input
            id="due_at"
            type="date"
            disabled={pending}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
      </div>

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

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href={`/dashboard/projects/${projectId}`} />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
