import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
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
import { Separator } from "@/components/ui/separator";
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
      "id, title, status, priority, due_at, estimate_hours, assignee:users(name, email)"
    )
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: true });

  const status = MILESTONE_STATUS[milestone.status];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/projects" className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="hover:underline"
        >
          {milestone.project?.name ?? "Project"}
        </Link>
        <span>/</span>
        <span>Milestone</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              #{milestone.sequence}
            </span>
            <h1 className="font-heading text-2xl font-medium">
              {milestone.name}
            </h1>
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Target: {formatDate(milestone.target_date)}
            {milestone.completed_at
              ? ` · Completed ${formatDate(milestone.completed_at)}`
              : ""}
          </p>
          {milestone.description ? (
            <p className="mt-1 max-w-2xl text-sm text-foreground/90">
              {milestone.description}
            </p>
          ) : null}
        </div>
        <Button
          render={
            <Link
              href={`/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/new`}
            />
          }
        >
          Add task
        </Button>
      </div>

      <Separator />

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
                const assigneeDisplay =
                  task.assignee?.name ??
                  task.assignee?.email ??
                  "Unassigned";
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
    </div>
  );
}
