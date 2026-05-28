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
  PROJECT_STATUS,
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

type TaskRow = {
  id: string;
  milestone_id: string;
  title: string;
  status: keyof typeof TASK_STATUS;
  priority: keyof typeof TASK_PRIORITY;
  due_at: string | null;
  estimate_hours: number | null;
  assignee: { name: string | null; email: string } | null;
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, description, status, started_at, expected_end_at, company:companies(name), pm:users(name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load project: {projectError.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!project) {
    notFound();
  }

  const [{ data: milestones }, { data: tasks }] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, sequence, name, description, status, target_date")
      .eq("project_id", id)
      .order("sequence", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, milestone_id, title, status, priority, due_at, estimate_hours, assignee:users(name, email)"
      )
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const tasksByMilestone = new Map<string, TaskRow[]>();
  for (const task of (tasks ?? []) as TaskRow[]) {
    const bucket = tasksByMilestone.get(task.milestone_id) ?? [];
    bucket.push(task);
    tasksByMilestone.set(task.milestone_id, bucket);
  }

  const projectStatus = PROJECT_STATUS[project.status];
  const pmDisplay = project.pm?.name ?? project.pm?.email ?? "Unassigned";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/projects"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Projects
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-medium">
              {project.name}
            </h1>
            <Badge
              variant={projectStatus.variant}
              className={projectStatus.className}
            >
              {projectStatus.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.company?.name ?? "—"} · PM: {pmDisplay}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(project.started_at)} →{" "}
            {formatDate(project.expected_end_at)}
          </p>
          {project.description ? (
            <p className="mt-2 max-w-2xl text-sm text-foreground/90">
              {project.description}
            </p>
          ) : null}
        </div>
        <Button
          render={<Link href={`/dashboard/projects/${id}/milestones/new`} />}
        >
          Add milestone
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">Milestones</h2>

        {!milestones || milestones.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No milestones yet</CardTitle>
              <CardDescription>
                Add the first phase of this project to start breaking work
                down.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                render={
                  <Link href={`/dashboard/projects/${id}/milestones/new`} />
                }
              >
                Add milestone
              </Button>
            </CardContent>
          </Card>
        ) : (
          milestones.map((milestone) => {
            const status = MILESTONE_STATUS[milestone.status];
            const milestoneTasks = tasksByMilestone.get(milestone.id) ?? [];
            return (
              <Card key={milestone.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          #{milestone.sequence}
                        </span>
                        <CardTitle className="text-base">
                          <Link
                            href={`/dashboard/projects/${id}/milestones/${milestone.id}`}
                            className="hover:underline"
                          >
                            {milestone.name}
                          </Link>
                        </CardTitle>
                        <Badge
                          variant={status.variant}
                          className={status.className}
                        >
                          {status.label}
                        </Badge>
                      </div>
                      {milestone.target_date ? (
                        <p className="text-xs text-muted-foreground">
                          Target: {formatDate(milestone.target_date)}
                        </p>
                      ) : null}
                      {milestone.description ? (
                        <p className="text-sm text-muted-foreground">
                          {milestone.description}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link
                          href={`/dashboard/projects/${id}/milestones/${milestone.id}/tasks/new`}
                        />
                      }
                    >
                      Add task
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {milestoneTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tasks yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {milestoneTasks.map((task) => {
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
                                href={`/dashboard/projects/${id}/milestones/${milestone.id}/tasks/${task.id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {task.title}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {assigneeDisplay}
                                {task.estimate_hours != null
                                  ? ` · ${task.estimate_hours}h`
                                  : ""}
                                {task.due_at
                                  ? ` · due ${formatDate(task.due_at)}`
                                  : ""}
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
            );
          })
        )}
      </div>

      <AttachmentsCard
        entityType="project"
        entityId={project.id}
        revalidatePath={`/dashboard/projects/${id}`}
      />
    </div>
  );
}
