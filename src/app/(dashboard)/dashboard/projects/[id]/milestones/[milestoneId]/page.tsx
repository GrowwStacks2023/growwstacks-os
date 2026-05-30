import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { Page, PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { userDisplay } from "@/lib/display";
import {
  MILESTONE_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
} from "@/lib/status-colors";
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

export default async function MilestoneDetailPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const { id: projectId, milestoneId } = await params;
  const role = await getCurrentRole();
  const mayEdit = canEdit(role, "milestone");
  const supabase = await createClient();

  const { data: milestone, error } = await supabase
    .from("milestones")
    .select(
      "id, project_id, sequence, name, description, status, target_date, completed_at, created_at, project:projects(id, name)"
    )
    .eq("id", milestoneId)
    .maybeSingle();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load milestone: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Guard against URL-tampering where the milestone exists but belongs to a
  // different project than the one in the URL.
  if (!milestone || milestone.project_id !== projectId) {
    notFound();
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_at, estimate_hours, assignee:users!tasks_assignee_id_fkey(name, email)"
    )
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: true });

  const status = MILESTONE_STATUS[milestone.status];

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          {
            label: milestone.project?.name ?? "Project",
            href: `/dashboard/projects/${projectId}`,
          },
          { label: `#${milestone.sequence} ${milestone.name}` },
        ]}
        title={milestone.name}
        description={
          <>
            Target: {formatDate(milestone.target_date)}
            {milestone.completed_at
              ? ` · Completed ${formatDate(milestone.completed_at)}`
              : ""}
          </>
        }
        meta={
          <>
            <span className="text-sm text-muted-foreground">
              #{milestone.sequence}
            </span>
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              render={
                <Link
                  href={`/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/new`}
                />
              }
            >
              Add task
            </Button>
            {mayEdit ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/dashboard/projects/${projectId}/milestones/${milestoneId}/edit`}
                  />
                }
              >
                Edit
              </Button>
            ) : null}
          </div>
        }
      />

      {milestone.description ? (
        <p className="max-w-2xl text-sm text-foreground/90">
          {milestone.description}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
          <CardDescription>Work units inside this milestone.</CardDescription>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => {
                const taskStatus = TASK_STATUS[task.status];
                const taskPriority = TASK_PRIORITY[task.priority];
                const assigneeDisplay = userDisplay(
                  task.assignee,
                  "Unassigned"
                );
                return (
                  <li
                    key={task.id}
                    className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/${task.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {task.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {assigneeDisplay}
                        {task.estimate_hours != null
                          ? ` · ${task.estimate_hours}h`
                          : ""}
                        {task.due_at ? ` · due ${formatDate(task.due_at)}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={taskPriority.variant}
                        className={taskPriority.className}
                      >
                        {taskPriority.label}
                      </Badge>
                      <Badge
                        variant={taskStatus.variant}
                        className={taskStatus.className}
                      >
                        {taskStatus.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AttachmentsCard
        entityType="milestone"
        entityId={milestone.id}
        revalidatePath={`/dashboard/projects/${projectId}/milestones/${milestoneId}`}
      />
    </Page>
  );
}
