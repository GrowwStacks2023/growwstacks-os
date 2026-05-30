"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

// Team membership is gated by canEdit on the project — same role set
// (admin + pm) that can edit the project itself. The 0020 RLS policies
// echo this.

function canManageTeam(role: string | null): boolean {
  return role === "admin" || role === "pm";
}

export type AddTeamMemberResult = { ok: true } | { ok: false; error: string };

export async function addProjectTeamMember(
  projectId: string,
  userId: string
): Promise<AddTeamMemberResult> {
  const role = await getCurrentRole();
  if (!canManageTeam(role)) {
    return { ok: false, error: "Not authorized." };
  }
  if (!projectId || !userId) {
    return { ok: false, error: "Missing project or user id." };
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("project_team_members").insert({
    project_id: projectId,
    user_id: userId,
    added_by: actor?.id ?? null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This person is already on the team." };
    }
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Project or user not found.",
      };
    }
    return { ok: false, error: error.message };
  }

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "project",
      entity_id: projectId,
      action: "team_member_added",
      actor_id: actor?.id ?? null,
      after_state: { user_id: userId },
    })
    .then(() => undefined, () => undefined);

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

export type RemoveTeamMemberResult =
  | { ok: true }
  | { ok: false; error: string };

export async function removeProjectTeamMember(
  projectId: string,
  userId: string
): Promise<RemoveTeamMemberResult> {
  const role = await getCurrentRole();
  if (!canManageTeam(role)) {
    return { ok: false, error: "Not authorized." };
  }
  if (!projectId || !userId) {
    return { ok: false, error: "Missing project or user id." };
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("project_team_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "project",
      entity_id: projectId,
      action: "team_member_removed",
      actor_id: actor?.id ?? null,
      after_state: { user_id: userId },
    })
    .then(() => undefined, () => undefined);

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
