import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { MilestoneAttachmentsToggle } from "@/components/attachments/milestone-attachments-toggle";
import { DeleteAction } from "@/components/delete-action";
import { Page, PageHeader, Section } from "@/components/page-shell";
import { PaymentsCard } from "@/components/payments";
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
import { canCreate, canDelete, canEditProjectArea } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { userDisplay } from "@/lib/display";
import {
  MILESTONE_STATUS,
  PROJECT_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
} from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

import { deleteProject } from "../mutations";
import { deleteMilestone } from "./milestones/mutations";
import {
  AddTeamMemberPicker,
  RemoveTeamMemberButton,
  TeamMemberChip,
  type TeamCandidate,
} from "./team-controls";

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
  const role = await getCurrentRole();
  const canEdit = canEditProjectArea(role);

  // Developer access scoping: a developer can reach a project if EITHER
  // they're on the team OR they have a task assigned in it. After
  // migration 0021 these two converge in normal use, but the OR keeps
  // the page reachable for legitimate task assignments before the
  // trigger's effect is visible.
  if (role === "developer") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const [{ data: membership }, { data: taskRow }] = await Promise.all([
      supabase
        .from("project_team_members")
        .select("user_id")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id")
        .eq("project_id", id)
        .eq("assignee_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);
    if (!membership && !taskRow) {
      redirect("/dashboard/projects");
    }
  }
  // Matrix: developer cannot create milestones or tasks (read-only for
  // them on these). canEditProjectArea includes developer, so we gate
  // the Add buttons separately.
  const mayCreateMilestone = canCreate(role, "milestone");
  const mayCreateTask = canCreate(role, "task");
  const mayDeleteProject = canDelete(role, "project");
  const mayDeleteMilestone = canDelete(role, "milestone");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, description, status, started_at, expected_end_at, company_id, company:companies(name), pm:users!projects_pm_id_fkey(name, email), deal:deals(value_inr, value_usd)"
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

  // For sales (read-only summary), we don't need the task drilldown —
  // skip that fetch entirely. Milestones are still fetched so the summary
  // can show progress.
  const showTeamSection = role !== "sales";
  const mayManageTeam = role === "admin" || role === "pm";

  const [
    { data: milestones },
    { data: tasks },
    { data: teamRows },
  ] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, sequence, name, description, status, target_date")
      .eq("project_id", id)
      .order("sequence", { ascending: true }),
    canEdit
      ? supabase
          .from("tasks")
          .select(
            "id, milestone_id, title, status, priority, due_at, estimate_hours, assignee:users!tasks_assignee_id_fkey(name, email)"
          )
          .eq("project_id", id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as TaskRow[] }),
    showTeamSection
      ? supabase
          .from("project_team_members")
          .select(
            "user_id, added_at, member:users!project_team_members_user_id_fkey(id, name, email, role, is_active)"
          )
          .eq("project_id", id)
          .order("added_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  type TeamMember = {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  const team: TeamMember[] = (teamRows ?? [])
    .map((r) => {
      const m = r.member as unknown as
        | { id: string; name: string | null; email: string; role: string; is_active: boolean }
        | null;
      return m && m.is_active
        ? { id: m.id, name: m.name, email: m.email, role: m.role }
        : null;
    })
    .filter((x): x is TeamMember => x !== null);

  // Add-team-member picker: active developers not already on the team.
  let teamCandidates: TeamCandidate[] = [];
  if (mayManageTeam) {
    const memberIds = team.map((m) => m.id);
    const { data: devs } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("role", "developer")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    teamCandidates = (devs ?? []).filter((u) => !memberIds.includes(u.id));
  }

  const tasksByMilestone = new Map<string, TaskRow[]>();
  for (const task of (tasks ?? []) as TaskRow[]) {
    const bucket = tasksByMilestone.get(task.milestone_id) ?? [];
    bucket.push(task);
    tasksByMilestone.set(task.milestone_id, bucket);
  }

  // ── Milestone attachment counts (one batched query) ──────────────────
  // Polymorphic attachments table — entity_type='milestone', entity_id is
  // the milestone id. One IN(...) query, group client-side into a Map.
  // RLS already scopes this to milestones the caller can see; if the user
  // can read this project page they can read its milestone attachments.
  const milestoneIds = (milestones ?? []).map((m) => m.id);
  const attachmentCountByMilestone = new Map<string, number>();
  if (canEdit && milestoneIds.length > 0) {
    // Hidden from sales entirely (see toggle render below) so we skip the
    // query for sales — saves a round-trip and matches the project-level
    // AttachmentsCard which is also hidden for sales further down.
    const { data: rows } = await supabase
      .from("attachments")
      .select("entity_id")
      .eq("entity_type", "milestone")
      .in("entity_id", milestoneIds);
    for (const r of rows ?? []) {
      attachmentCountByMilestone.set(
        r.entity_id,
        (attachmentCountByMilestone.get(r.entity_id) ?? 0) + 1
      );
    }
  }

  const projectStatus = PROJECT_STATUS[project.status];
  const pmDisplay = userDisplay(project.pm, "Unassigned");

  // Summary numbers for the sales-mode header line.
  const totalMilestones = milestones?.length ?? 0;
  const completedMilestones = (milestones ?? []).filter(
    (m) => m.status === "completed"
  ).length;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.name },
        ]}
        title={project.name}
        description={
          <>
            {project.company?.name ?? (
              <span className="italic text-ink-400">Internal project</span>
            )} · PM: {pmDisplay} ·{" "}
            {formatDate(project.started_at)} →{" "}
            {formatDate(project.expected_end_at)}
            {!canEdit ? (
              <span className="text-xs">
                {" "}· Read-only view · {completedMilestones} /{" "}
                {totalMilestones} milestones complete
              </span>
            ) : null}
          </>
        }
        meta={
          <Badge
            variant={projectStatus.variant}
            className={projectStatus.className}
          >
            {projectStatus.label}
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            {mayCreateMilestone ? (
              <Button
                render={
                  <Link href={`/dashboard/projects/${id}/milestones/new`} />
                }
              >
                Add milestone
              </Button>
            ) : null}
            {mayDeleteProject ? (
              <DeleteAction
                title={`Delete ${project.name}?`}
                description="This will permanently delete the project AND every milestone, task, and attachment inside it. This cannot be undone."
                onConfirm={async () => {
                  "use server";
                  return deleteProject(id);
                }}
                redirectTo="/dashboard/projects"
              />
            ) : null}
          </div>
        }
      />

      {project.description ? (
        <p className="max-w-2xl text-sm text-foreground/90">
          {project.description}
        </p>
      ) : null}

      <Section title="Milestones">

        {!milestones || milestones.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No milestones yet</CardTitle>
              <CardDescription>
                {canEdit
                  ? "Add the first phase of this project to start breaking work down."
                  : "No milestones to show yet."}
              </CardDescription>
            </CardHeader>
            {mayCreateMilestone ? (
              <CardContent>
                <Button
                  render={
                    <Link href={`/dashboard/projects/${id}/milestones/new`} />
                  }
                >
                  Add milestone
                </Button>
              </CardContent>
            ) : null}
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
                    <div className="flex items-center gap-2">
                      {mayCreateTask ? (
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
                      ) : null}
                      {mayDeleteMilestone ? (
                        <DeleteAction
                          title={`Delete milestone "${milestone.name}"?`}
                          description="This will also delete every task inside this milestone. This cannot be undone."
                          onConfirm={async () => {
                            "use server";
                            return deleteMilestone(milestone.id, id);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                {canEdit ? (
                <CardContent className="flex flex-col gap-4">
                  {milestoneTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tasks yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {milestoneTasks.map((task) => {
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

                  {/*
                    Per-milestone attachments toggle. Hairline-separated
                    footer row inside the milestone card. The AttachmentsCard
                    server component is rendered eagerly as `children` —
                    its existing fetch happens during the project page's
                    server render — and the client toggle just controls
                    visibility. Hidden for sales: the project-level
                    AttachmentsCard below is already hidden for sales for
                    the same "no read-only mode in AttachmentsPanel" reason,
                    so we keep the milestone toggle consistent.
                  */}
                  <div className="border-t border-line pt-4">
                    <MilestoneAttachmentsToggle
                      initialCount={
                        attachmentCountByMilestone.get(milestone.id) ?? 0
                      }
                    >
                      <AttachmentsCard
                        entityType="milestone"
                        entityId={milestone.id}
                        revalidatePath={`/dashboard/projects/${id}`}
                      />
                    </MilestoneAttachmentsToggle>
                  </div>
                </CardContent>
                ) : null}
              </Card>
            );
          })
        )}
      </Section>

      {showTeamSection ? (
        <Section
          title="Team"
          description={
            mayManageTeam
              ? "Developers added here can see the project and update their assigned tasks."
              : "Developers on this project."
          }
        >
          <Card>
            <CardContent className="flex flex-col gap-4">
              {team.length === 0 ? (
                <p className="text-sm text-ink-500">
                  No team members yet.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {team.map((member) => (
                    <li
                      key={member.id}
                      className="inline-flex items-center gap-1"
                    >
                      <TeamMemberChip
                        user={{
                          id: member.id,
                          name: member.name,
                          email: member.email,
                        }}
                      />
                      {mayManageTeam ? (
                        <RemoveTeamMemberButton
                          projectId={id}
                          userId={member.id}
                          userLabel={member.name?.trim() || member.email}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {mayManageTeam ? (
                <AddTeamMemberPicker
                  projectId={id}
                  candidates={teamCandidates}
                />
              ) : null}
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {/*
        PaymentsCard stays for sales — the access matrix grants sales
        full payment read+write. The card itself role-gates internally
        (devs/clients see nothing).
        Internal projects (no company) have no payments side — payments.company_id
        is NOT NULL, so we hide the whole card.
      */}
      {project.company_id ? (
        <PaymentsCard
          projectId={project.id}
          companyId={project.company_id}
          expectedInr={project.deal?.value_inr ?? null}
          expectedUsd={project.deal?.value_usd ?? null}
          revalidatePath={`/dashboard/projects/${id}`}
        />
      ) : null}

      {/*
        Attachments card hidden for the sales read-only view. The
        AttachmentsPanel doesn't yet have a view-only mode (upload form
        is built in); rather than ship a half-protected version, we hide
        the whole card. Sales who need a file should pull it from the
        deal/contact page where it was attached originally.
      */}
      {canEdit ? (
        <AttachmentsCard
          entityType="project"
          entityId={project.id}
          revalidatePath={`/dashboard/projects/${id}`}
        />
      ) : null}
    </Page>
  );
}
