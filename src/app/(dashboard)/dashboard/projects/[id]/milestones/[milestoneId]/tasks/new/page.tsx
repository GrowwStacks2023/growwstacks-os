import { notFound } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { FormCard } from "@/components/form";
import { getCurrentRole } from "@/lib/access-server";
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

  const [{ data: assignees }, { data: pmCandidates }, callerRole] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, email")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("users")
        .select("id, name, email")
        .in("role", ["admin", "pm"])
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      getCurrentRole(),
    ]);

  // PM-role caller: default the PM picker to themselves so they don't
  // have to pick. Field stays editable.
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  const defaultPmId =
    callerRole === "pm" && actor?.id ? actor.id : null;

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
          pmCandidates={pmCandidates ?? []}
          defaultPmId={defaultPmId}
          cancelHref={`/dashboard/projects/${id}`}
        />
      </FormCard>
    </Page>
  );
}
