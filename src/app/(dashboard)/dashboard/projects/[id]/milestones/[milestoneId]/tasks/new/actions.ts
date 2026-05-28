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

export async function createTask(
  projectId: string,
  milestoneId: string,
  _prevState: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = nullIfBlank(String(formData.get("description") ?? ""));
  const assigneeRaw = nullIfBlank(String(formData.get("assignee_id") ?? ""));
  const statusRaw = String(formData.get("status") ?? "todo");
  const priorityRaw = String(formData.get("priority") ?? "medium");
  const estimateHours = numberOrNull(
    String(formData.get("estimate_hours") ?? "")
  );
  const dueAt = dateOrNull(String(formData.get("due_at") ?? ""));

  if (!title) {
    return { error: "Task title is required." };
  }

  const status = (TASK_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as TaskStatus)
    : "todo";
  const priority = (TASK_PRIORITIES as readonly string[]).includes(priorityRaw)
    ? (priorityRaw as TaskPriority)
    : "medium";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // The consistency trigger requires tasks.project_id to match the parent
  // milestone's project_id. Re-fetch from the milestone (don't trust the URL
  // segment blindly) so a tampered URL can't smuggle a mismatched project_id
  // past us.
  const { data: milestone, error: milestoneError } = await supabase
    .from("milestones")
    .select("id, project_id")
    .eq("id", milestoneId)
    .maybeSingle();

  if (milestoneError || !milestone) {
    return { error: "Milestone not found." };
  }

  if (milestone.project_id !== projectId) {
    return { error: "This milestone doesn't belong to that project." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert({
      milestone_id: milestone.id,
      project_id: milestone.project_id,
      title,
      description,
      status,
      priority,
      assignee_id: assigneeRaw,
      estimate_hours: estimateHours,
      due_at: dueAt,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the task.",
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

  redirect(`/dashboard/projects/${projectId}`);
}
