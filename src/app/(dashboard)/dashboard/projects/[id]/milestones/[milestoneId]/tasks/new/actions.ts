"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];

const TASK_STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
] as const;

const TASK_PRIORITIES: readonly TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type CreateTaskState = {
  error: string | null;
  taskId: string | null;
};

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function dateOrNull(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

function numberOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Direct entry point so the create form can stage attachments and commit
// them client-side after the row exists.
export async function createTaskDirect(input: {
  projectId: string;
  milestoneId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  estimateHours: number | null;
  dueAt: string | null;
}): Promise<CreateTaskState> {
  const title = input.title.trim();
  if (!title) {
    return { error: "Task title is required.", taskId: null };
  }

  const status = (TASK_STATUSES as readonly string[]).includes(input.status)
    ? (input.status as TaskStatus)
    : "todo";
  const priority = (TASK_PRIORITIES as readonly string[]).includes(
    input.priority
  )
    ? (input.priority as TaskPriority)
    : "medium";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", taskId: null };
  }

  // Re-fetch from the milestone so a tampered URL can't smuggle a mismatched
  // project_id past the consistency trigger.
  const { data: milestone, error: milestoneError } = await supabase
    .from("milestones")
    .select("id, project_id")
    .eq("id", input.milestoneId)
    .maybeSingle();

  if (milestoneError || !milestone) {
    return { error: "Milestone not found.", taskId: null };
  }
  if (milestone.project_id !== input.projectId) {
    return {
      error: "This milestone doesn't belong to that project.",
      taskId: null,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert({
      milestone_id: milestone.id,
      project_id: milestone.project_id,
      title,
      description: input.description,
      status,
      priority,
      assignee_id: input.assigneeId,
      estimate_hours: input.estimateHours,
      due_at: input.dueAt,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the task.",
      taskId: null,
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "task",
    entity_id: inserted.id,
    action: "created",
    actor_id: user.id,
    after_state: inserted,
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  return { error: null, taskId: inserted.id };
}

// FormData wrapper retained in case a server-action submission is ever
// re-introduced. Mirrors the contact / deal pattern: validates, delegates,
// redirects on success.
export async function createTask(
  projectId: string,
  milestoneId: string,
  _prevState: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const result = await createTaskDirect({
    projectId,
    milestoneId,
    title: String(formData.get("title") ?? ""),
    description: nullIfBlank(String(formData.get("description") ?? "")),
    status: String(formData.get("status") ?? "todo"),
    priority: String(formData.get("priority") ?? "medium"),
    assigneeId: nullIfBlank(String(formData.get("assignee_id") ?? "")),
    estimateHours: numberOrNull(String(formData.get("estimate_hours") ?? "")),
    dueAt: dateOrNull(String(formData.get("due_at") ?? "")),
  });

  if (result.error || !result.taskId) {
    return result;
  }

  redirect(
    `/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/${result.taskId}`
  );
}
