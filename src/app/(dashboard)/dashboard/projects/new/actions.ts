"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ProjectStatus = Database["public"]["Enums"]["project_status"];

const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type CreateProjectState = {
  error: string | null;
};

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function dateOrNull(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // <input type="date"> produces "YYYY-MM-DD"; Postgres can cast that to
  // timestamptz directly, but pass an explicit midnight UTC for clarity.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const name = String(formData.get("name") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const description = nullIfBlank(String(formData.get("description") ?? ""));
  const statusRaw = String(formData.get("status") ?? "planning");
  const pmRaw = nullIfBlank(String(formData.get("pm_id") ?? ""));
  const startedAt = dateOrNull(String(formData.get("started_at") ?? ""));
  const expectedEndAt = dateOrNull(
    String(formData.get("expected_end_at") ?? "")
  );

  if (!name) {
    return { error: "Project name is required." };
  }

  if (!companyId) {
    return { error: "Please pick a company for this project." };
  }

  const status = (PROJECT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as ProjectStatus)
    : "planning";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("projects")
    .insert({
      company_id: companyId,
      name,
      description,
      status,
      pm_id: pmRaw,
      started_at: startedAt,
      expected_end_at: expectedEndAt,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the project.",
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "project",
    entity_id: inserted.id,
    action: "created",
    actor_id: user.id,
    after_state: inserted,
  });

  if (logError) {
    // Don't fail the user-facing flow if the audit row is rejected, but surface
    // it to the server logs so we notice if RLS bites us.
    console.error("activity_log insert failed:", logError);
  }

  redirect(`/dashboard/projects/${inserted.id}`);
}
