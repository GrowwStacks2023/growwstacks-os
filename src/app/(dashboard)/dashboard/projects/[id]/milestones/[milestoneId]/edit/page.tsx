import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditMilestoneForm } from "./edit-milestone-form";

export default async function EditMilestonePage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const { id: projectId, milestoneId } = await params;
  const role = await getCurrentRole();
  if (!canEdit(role, "milestone")) {
    redirect(`/dashboard/projects/${projectId}/milestones/${milestoneId}`);
  }

  const supabase = await createClient();
  const { data: milestone } = await supabase
    .from("milestones")
    .select(
      "id, project_id, name, description, status, sequence, target_date, project:projects(name)"
    )
    .eq("id", milestoneId)
    .maybeSingle();

  // Guard against URL-tampering — milestone exists but belongs to another
  // project than the one in the path.
  if (!milestone || milestone.project_id !== projectId) {
    notFound();
  }

  const projectName = milestone.project?.name ?? "Project";

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          {
            label: projectName,
            href: `/dashboard/projects/${projectId}`,
          },
          {
            label: `#${milestone.sequence} ${milestone.name}`,
            href: `/dashboard/projects/${projectId}/milestones/${milestoneId}`,
          },
          { label: "Edit" },
        ]}
      />
      <FormCard
        title={`Edit ${milestone.name}`}
        subtitle={
          <>
            Milestone in <span className="font-semibold text-ink-900">{projectName}</span>.
          </>
        }
      >
        <EditMilestoneForm
          projectId={projectId}
          milestone={{
            id: milestone.id,
            name: milestone.name,
            description: milestone.description,
            status: milestone.status,
            sequence: milestone.sequence,
            targetDate: milestone.target_date ?? "",
          }}
        />
      </FormCard>
    </Page>
  );
}
