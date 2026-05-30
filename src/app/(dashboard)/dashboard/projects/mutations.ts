"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ProjectStatus = Database["public"]["Enums"]["project_status"];
const STATUSES: readonly ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type UpdateProjectResult = { ok: true } | { ok: false; error: string };

export async function updateProject(input: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  // Nullable per Task 26 Phase B (internal projects with no company).
  companyId: string | null;
  contactId: string | null;
  pmId: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
}): Promise<UpdateProjectResult> {
  const role = await getCurrentRole();
  if (!canEdit(role, "project")) {
    return { ok: false, error: "You don't have permission to edit projects." };
  }
  if (!input.id) return { ok: false, error: "Missing project id." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Project name is required." };
  const status = (STATUSES as readonly string[]).includes(input.status)
    ? (input.status as ProjectStatus)
    : null;
  if (!status) return { ok: false, error: "Invalid project status." };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("projects")
    .select(
      "id, name, description, status, company_id, contact_id, pm_id, started_at, expected_end_at"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Project not found." };
  }

  const after = {
    name,
    description: input.description,
    status,
    company_id: input.companyId,
    contact_id: input.contactId,
    pm_id: input.pmId,
    started_at: input.startedAt,
    expected_end_at: input.expectedEndAt,
  };

  const { error } = await supabase
    .from("projects")
    .update(after)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "project",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "name",
      "description",
      "status",
      "company_id",
      "contact_id",
      "pm_id",
      "started_at",
      "expected_end_at",
    ]),
  });

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${input.id}`);
  return { ok: true };
}

export type DeleteProjectResult = { ok: true } | { ok: false; error: string };

// Cascades through to milestones, tasks (via project_id), and any
// attachments hanging off those — but ONLY because those FKs are
// ON DELETE CASCADE. The UI confirmation explicitly warns about this.
export async function deleteProject(id: string): Promise<DeleteProjectResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "project")) {
    return {
      ok: false,
      error: "You don't have permission to delete projects.",
    };
  }
  if (!id) return { ok: false, error: "Missing project id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "project",
      entity_id: id,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/projects");
  return { ok: true };
}
