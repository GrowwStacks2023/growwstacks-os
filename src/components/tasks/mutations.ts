"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit, canEditOwnTaskOnly } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];

const STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
] as const;
const PRIORITIES: readonly TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

function isStatus(v: string): v is TaskStatus {
  return (STATUSES as readonly string[]).includes(v);
}
function isPriority(v: string): v is TaskPriority {
  return (PRIORITIES as readonly string[]).includes(v);
}

export type UpdateTaskResult = { ok: true } | { ok: false; error: string };

// Full edit — admin / pm only. Touches every editable field.
export async function updateTask(input: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  pmId: string | null;
  estimateHours: number | null;
  dueAt: string | null;
}): Promise<UpdateTaskResult> {
  const role = await getCurrentRole();
  if (!canEdit(role, "task")) {
    return { ok: false, error: "You don't have permission to edit tasks." };
  }
  if (!input.id) return { ok: false, error: "Missing task id." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Task title is required." };
  if (!isStatus(input.status)) {
    return { ok: false, error: "Invalid task status." };
  }
  if (!isPriority(input.priority)) {
    return { ok: false, error: "Invalid task priority." };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, assignee_id, pm_id, estimate_hours, due_at"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Task not found." };
  }

  const after = {
    title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    assignee_id: input.assigneeId,
    pm_id: input.pmId,
    estimate_hours: input.estimateHours,
    due_at: input.dueAt,
  };

  const { error } = await supabase
    .from("tasks")
    .update(after)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "task",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "title",
      "description",
      "status",
      "priority",
      "assignee_id",
      "pm_id",
      "estimate_hours",
      "due_at",
    ]),
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${input.id}`);
  return { ok: true };
}

export type UpdateOwnTaskStatusResult =
  | { ok: true }
  | { ok: false; error: string };

// Developer-only narrow edit: status only, on a task they're the
// assignee of. Anyone else (or a developer on a task assigned to
// someone else) gets denied. The action validates the assignee_id
// against the calling user before writing.
export async function updateOwnTaskStatus(
  taskId: string,
  newStatus: string
): Promise<UpdateOwnTaskStatusResult> {
  const role = await getCurrentRole();
  if (!canEditOwnTaskOnly(role) && !canEdit(role, "task")) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isStatus(newStatus)) {
    return { ok: false, error: "Invalid task status." };
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) return { ok: false, error: "You must be signed in." };

  // Pre-fetch enough to do the assignee check AND have a before-snapshot
  // for the audit row. Single round trip.
  const { data: before } = await supabase
    .from("tasks")
    .select("id, status, assignee_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!before) return { ok: false, error: "Task not found." };

  // Developers must be the task's assignee. Admin/PM can update any
  // task (canEdit(role,'task') is true for them).
  if (canEditOwnTaskOnly(role) && before.assignee_id !== actor.id) {
    return {
      ok: false,
      error: "You can only change status on tasks assigned to you.",
    };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  await logEntityUpdate(supabase, {
    entityType: "task",
    entityId: taskId,
    actorId: actor.id,
    diff: diffPayload(before, { status: newStatus }, ["status"]),
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export type DeleteTaskResult = { ok: true } | { ok: false; error: string };

export async function deleteTask(taskId: string): Promise<DeleteTaskResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "task")) {
    return { ok: false, error: "You don't have permission to delete tasks." };
  }
  if (!taskId) return { ok: false, error: "Missing task id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "task",
      entity_id: taskId,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/tasks");
  return { ok: true };
}
