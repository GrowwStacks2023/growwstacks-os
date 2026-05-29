import { notFound } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { FormCard } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const { id, milestoneId } = await params;
  const supabase = await createClient();

  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, name, project_id, project:projects(name)")
    .eq("id", milestoneId)
    .maybeSingle();

  // Defence-in-depth: the route is /projects/[id]/milestones/[milestoneId] —
  // if those two ids disagree, 404 rather than letting the trigger reject it
  // later.
  if (!milestone || milestone.project_id !== id) {
    notFound();
  }

  const { data: assignees } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          {
            label: milestone.project?.name ?? "Project",
            href: `/dashboard/projects/${id}`,
          },
          {
            label: milestone.name,
            href: `/dashboard/projects/${id}/milestones/${milestoneId}`,
          },
          { label: "New task" },
        ]}
      />
      <FormCard
        title="New task"
        subtitle={
          <>
            Under milestone{" "}
            <span className="font-semibold text-ink-900">{milestone.name}</span>
            {milestone.project?.name ? (
              <>
                {" "}· in{" "}
                <span className="font-semibold text-ink-900">{milestone.project.name}</span>
              </>
            ) : null}
            .
          </>
        }
      >
        <NewTaskForm
          context={{ kind: "milestone", projectId: id, milestoneId }}
          assignees={assignees ?? []}
          cancelHref={`/dashboard/projects/${id}`}
        />
      </FormCard>
    </Page>
  );
}
