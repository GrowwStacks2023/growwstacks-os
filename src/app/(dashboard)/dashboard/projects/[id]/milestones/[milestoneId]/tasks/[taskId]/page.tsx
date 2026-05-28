import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string; taskId: string }>;
}) {
  const {
    id: projectId,
    milestoneId,
    taskId,
  } = await params;
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id, project_id, milestone_id, title, description, status, priority, estimate_hours, actual_hours, due_at, completed_at, created_at, client_visible, assignee:users(name, email), project:projects(id, name), milestone:milestones(id, name, sequence)"
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

  // URL tamper guard, same shape as the milestone page.
  if (
    !task ||
    task.project_id !== projectId ||
    task.milestone_id !== milestoneId
  ) {
    notFound();
  }

  const status = TASK_STATUS[task.status];
  const priority = TASK_PRIORITY[task.priority];
  const assigneeDisplay =
    task.assignee?.name ?? task.assignee?.email ?? "Unassigned";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/projects" className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="hover:underline"
        >
          {task.project?.name ?? "Project"}
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}/milestones/${milestoneId}`}
          className="hover:underline"
        >
          {task.milestone
            ? `#${task.milestone.sequence} ${task.milestone.name}`
            : "Milestone"}
        </Link>
        <span>/</span>
        <span>Task</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-medium">{task.title}</h1>
          <Badge variant={priority.variant} className={priority.className}>
            {priority.label}
          </Badge>
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Assignee:</dt>
            <dd>{assigneeDisplay}</dd>
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

      <Separator />

      <AttachmentsCard
        entityType="task"
        entityId={task.id}
        revalidatePath={`/dashboard/projects/${projectId}/milestones/${milestoneId}/tasks/${taskId}`}
      />
    </div>
  );
}
