import { notFound } from "next/navigation";

import Link from "next/link";

import { AttachmentsCard } from "@/components/attachments";
import { DeleteAction } from "@/components/delete-action";
import { Page, PageHeader, type Crumb } from "@/components/page-shell";
import { deleteTask } from "@/components/tasks/mutations";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canDelete, canEdit, canEditOwnTaskOnly } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { userDisplay } from "@/lib/display";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

// Universal task detail. Works for project-tied AND standalone (deal/contact)
// tasks. The milestone-scoped detail at
// /dashboard/projects/[id]/milestones/[milestoneId]/tasks/[taskId] still
// exists and continues to work for direct project navigation; this is the
// canonical entry point from the unified task list, deal pages, and
// contact pages.
export default async function UniversalTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const role = await getCurrentRole();
  const mayDelete = canDelete(role, "task");
  const supabase = await createClient();

  // Two FKs to users (assignee_id, pm_id) → must name the constraint
  // explicitly on the embedded join, per the Task 8 finding.
  // (Keep this select as a single string literal so Supabase's type
  // inference can introspect it — building via .join() breaks the
  // template-literal magic and collapses to GenericStringError.)
  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, estimate_hours, actual_hours, due_at, completed_at, created_at, client_visible, project_id, milestone_id, deal_id, contact_id, assignee_id, assignee:users!tasks_assignee_id_fkey(name, email), pm:users!tasks_pm_id_fkey(name, email), project:projects(id, name), milestone:milestones(id, name, sequence), deal:deals(id, title), contact:contacts(id, name)"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load task: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  // maybeSingle returns null both when the row doesn't exist AND when RLS
  // hides it from the caller — same UX either way.
  if (!task) {
    notFound();
  }

  // Edit visibility:
  //   admin/pm   → always show Edit
  //   developer  → show Edit ONLY if they're the assignee (otherwise
  //                /edit would just bounce them)
  //   sales/client → no Edit (they can't reach the dashboard task pages
  //                anyway, but be defensive)
  let mayEdit = canEdit(role, "task");
  if (!mayEdit && canEditOwnTaskOnly(role)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    mayEdit = !!user && task.assignee_id === user.id;
  }

  const status = TASK_STATUS[task.status];
  const priority = TASK_PRIORITY[task.priority];
  const assigneeDisplay = userDisplay(task.assignee, "Unassigned");
  const pmDisplay = userDisplay(task.pm, "—");

  // Pick the canonical context for breadcrumbs. Mirrors the list page's
  // priority order: milestone > project > deal > contact. We always anchor
  // at /dashboard (one click home) and end with the task title as the
  // terminal crumb (no href — that's where the user is).
  const crumbs: Crumb[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tasks", href: "/dashboard/tasks" },
  ];
  let contextLabel = "Standalone";
  if (task.milestone && task.project) {
    crumbs.push(
      {
        label: task.project.name,
        href: `/dashboard/projects/${task.project.id}`,
      },
      {
        label: `#${task.milestone.sequence} ${task.milestone.name}`,
        href: `/dashboard/projects/${task.project.id}/milestones/${task.milestone.id}`,
      }
    );
    contextLabel = `${task.project.name} · ${task.milestone.name}`;
  } else if (task.project) {
    crumbs.push({
      label: task.project.name,
      href: `/dashboard/projects/${task.project.id}`,
    });
    contextLabel = `Project: ${task.project.name}`;
  } else if (task.deal) {
    crumbs.push({
      label: task.deal.title,
      href: `/dashboard/deals/${task.deal.id}`,
    });
    contextLabel = `Deal: ${task.deal.title}`;
  } else if (task.contact) {
    crumbs.push({
      label: task.contact.name,
      href: `/dashboard/contacts/${task.contact.id}`,
    });
    contextLabel = `Contact: ${task.contact.name}`;
  }
  crumbs.push({ label: task.title });

  return (
    <Page>
      <PageHeader
        breadcrumbs={crumbs}
        title={task.title}
        description={contextLabel}
        meta={
          <>
            <Badge variant={priority.variant} className={priority.className}>
              {priority.label}
            </Badge>
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
          </>
        }
        action={
          mayEdit || mayDelete ? (
            <div className="flex items-center gap-2">
              {mayEdit ? (
                <Button
                  variant="outline"
                  render={<Link href={`/dashboard/tasks/${taskId}/edit`} />}
                >
                  Edit
                </Button>
              ) : null}
              {mayDelete ? (
                <DeleteAction
                  title={`Delete task "${task.title}"?`}
                  description="This cannot be undone."
                  onConfirm={async () => {
                    "use server";
                    return deleteTask(taskId);
                  }}
                  redirectTo="/dashboard/tasks"
                />
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="flex flex-col gap-2">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Assignee:</dt>
            <dd>{assigneeDisplay}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">PM:</dt>
            <dd>{pmDisplay}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Estimate:</dt>
            <dd>
              {task.estimate_hours != null ? `${task.estimate_hours}h` : "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Logged:</dt>
            <dd>
              {task.actual_hours != null ? `${task.actual_hours}h` : "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Due:</dt>
            <dd>{formatDate(task.due_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Completed:</dt>
            <dd>{formatDate(task.completed_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Client visible:</dt>
            <dd>{task.client_visible ? "Yes" : "No"}</dd>
          </div>
        </dl>
        {task.description ? (
          <p className="mt-2 max-w-2xl text-sm text-foreground/90 whitespace-pre-wrap">
            {task.description}
          </p>
        ) : null}
      </div>

      <AttachmentsCard
        entityType="task"
        entityId={task.id}
        revalidatePath={`/dashboard/tasks/${task.id}`}
      />
    </Page>
  );
}
