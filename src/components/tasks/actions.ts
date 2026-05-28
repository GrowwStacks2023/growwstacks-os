"use server";

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

// Discriminated context union — the create flow always knows exactly which
// shape it's building. The CHECK constraint in 0011 requires at least one
// context column, so these three are the legal shapes.
export type TaskContext =
  | { kind: "milestone"; projectId: string; milestoneId: string }
  | { kind: "deal"; dealId: string }
  | { kind: "contact"; contactId: string };

export type CreateTaskState = {
  error: string | null;
  taskId: string | null;
};

export async function createTaskDirect(input: {
  context: TaskContext;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  pmId: string | null;
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

  // Build the context columns based on the discriminator. Verify the
  // milestone case here so a tampered URL can't smuggle a mismatched
  // project_id past the consistency trigger (the trigger still catches it
  // either way; doing it here gives a clearer error).
  let milestone_id: string | null = null;
  let project_id: string | null = null;
  let deal_id: string | null = null;
  let contact_id: string | null = null;

  if (input.context.kind === "milestone") {
    const { data: milestone, error: milestoneError } = await supabase
      .from("milestones")
      .select("id, project_id")
      .eq("id", input.context.milestoneId)
      .maybeSingle();
    if (milestoneError || !milestone) {
      return { error: "Milestone not found.", taskId: null };
    }
    if (milestone.project_id !== input.context.projectId) {
      return {
        error: "This milestone doesn't belong to that project.",
        taskId: null,
      };
    }
    milestone_id = milestone.id;
    project_id = milestone.project_id;
  } else if (input.context.kind === "deal") {
    deal_id = input.context.dealId;
  } else {
    contact_id = input.context.contactId;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert({
      milestone_id,
      project_id,
      deal_id,
      contact_id,
      title,
      description: input.description,
      status,
      priority,
      assignee_id: input.assigneeId,
      pm_id: input.pmId,
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
