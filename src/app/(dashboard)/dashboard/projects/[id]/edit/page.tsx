import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditProjectForm } from "./edit-project-form";

// Turn a timestamptz like "2026-05-30T00:00:00.000Z" into the YYYY-MM-DD
// string an <input type="date"> expects. Forms send YYYY-MM-DD back; the
// updateProject action converts that to an ISO timestamp.
function dateForInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!canEdit(role, "project")) {
    redirect(`/dashboard/projects/${id}`);
  }

  const supabase = await createClient();
  const [projectRes, pmRes, contactsRes] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, description, status, company_id, contact_id, pm_id, started_at, expected_end_at, deal_id"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["pm", "admin"])
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, name, company_id, company:companies(name)")
      .order("name", { ascending: true }),
  ]);

  const project = projectRes.data;
  if (!project) notFound();

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          {
            label: project.name,
            href: `/dashboard/projects/${project.id}`,
          },
          { label: "Edit" },
        ]}
      />
      <FormCard
        title={`Edit ${project.name}`}
        subtitle={
          <>
            Update the project record. The originating deal stays linked and
            is read-only here.
          </>
        }
      >
        <EditProjectForm
          project={{
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            companyId: project.company_id,
            contactId: project.contact_id,
            pmId: project.pm_id,
            startedAt: dateForInput(project.started_at),
            expectedEndAt: dateForInput(project.expected_end_at),
            dealId: project.deal_id,
          }}
          contacts={(contactsRes.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            companyId: c.company_id ?? null,
            companyName: c.company?.name ?? null,
          }))}
          pmCandidates={pmRes.data ?? []}
        />
      </FormCard>
    </Page>
  );
}
