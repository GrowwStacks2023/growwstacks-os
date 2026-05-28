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
  projectId: string | null;
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

export async function createProjectDirect(input: {
  name: string;
  companyId: string;
  contactId: string | null;
  description: string | null;
  status: string;
  pmId: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
}): Promise<CreateProjectState> {
  const name = input.name.trim();
  if (!name) {
    return { error: "Project name is required.", projectId: null };
  }
  if (!input.companyId) {
    return {
      error: "Please pick a company for this project.",
      projectId: null,
    };
  }

  const status = (PROJECT_STATUSES as readonly string[]).includes(input.status)
    ? (input.status as ProjectStatus)
    : "planning";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", projectId: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("projects")
    .insert({
      company_id: input.companyId,
      contact_id: input.contactId,
      name,
      description: input.description,
      status,
      pm_id: input.pmId,
      started_at: input.startedAt,
      expected_end_at: input.expectedEndAt,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the project.",
      projectId: null,
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
    console.error("activity_log insert failed:", logError);
  }

  return { error: null, projectId: inserted.id };
}

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const result = await createProjectDirect({
    name: String(formData.get("name") ?? ""),
    companyId: String(formData.get("company_id") ?? "").trim(),
    contactId: nullIfBlank(String(formData.get("contact_id") ?? "")),
    description: nullIfBlank(String(formData.get("description") ?? "")),
    status: String(formData.get("status") ?? "planning"),
    pmId: nullIfBlank(String(formData.get("pm_id") ?? "")),
    startedAt: dateOrNull(String(formData.get("started_at") ?? "")),
    expectedEndAt: dateOrNull(String(formData.get("expected_end_at") ?? "")),
  });

  if (result.error || !result.projectId) {
    return result;
  }

  redirect(`/dashboard/projects/${result.projectId}`);
}
