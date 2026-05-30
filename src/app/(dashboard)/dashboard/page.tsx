import Link from "next/link";
import { redirect } from "next/navigation";

import { Page, PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { userDisplay } from "@/lib/display";
import {
  DEAL_STAGE,
  DEAL_STAGE_ORDER,
  PROJECT_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
} from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function formatStageTotal(inrTotal: number, usdTotal: number): string {
  const parts: string[] = [];
  if (inrTotal > 0) parts.push(inrFormatter.format(inrTotal));
  if (usdTotal > 0) parts.push(usdFormatter.format(usdTotal));
  return parts.length === 0 ? "—" : parts.join(" + ");
}

const TASK_DISPLAY_LIMIT = 10;
// Roles allowed to see the sales pipeline tile. Developers/clients are gated
// in-UI even though RLS would also block their deals query — belt and
// suspenders, and it avoids rendering an empty/confusing tile.
const PIPELINE_ROLES = new Set(["admin", "sales", "pm"]);

type OpenTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  project_id: string;
  project: { name: string } | null;
};

type ActiveProjectRow = {
  id: string;
  name: string;
  expected_end_at: string | null;
  company: { name: string } | null;
  pm: { name: string | null; email: string } | null;
};

type PipelineDeal = {
  stage: DealStage;
  value_inr: number | null;
  value_usd: number | null;
};

// Reusable KPI tile per spec — left accent bar via .kpi-card[data-accent],
// eyebrow label, big display value.
function KpiTile({
  accent,
  label,
  value,
  helper,
}: {
  accent: "blue" | "green" | "amber" | "violet";
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <div
      data-accent={accent}
      className="kpi-card flex flex-col gap-2 rounded-[14px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(10,37,64,0.05),0_1px_3px_rgba(10,37,64,0.06)]"
    >
      <span className="eyebrow">{label}</span>
      <div className="font-display text-[27px] font-semibold leading-none tracking-[-0.02em] text-ink-900">
        {value}
      </div>
      {helper ? (
        <div className="text-[13px] text-ink-500">{helper}</div>
      ) : null}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = userDisplay(
    { name: profile?.name ?? null, email: profile?.email ?? user.email ?? null },
    "there"
  );
  const role = profile?.role;
  const canSeePipeline = role ? PIPELINE_ROLES.has(role) : false;

  const dealsPromise = canSeePipeline
    ? supabase.from("deals").select("stage, value_inr, value_usd")
    : null;

  const isDeveloper = role === "developer";

  const [
    tasksResult,
    projectsResult,
    dealsResult,
    devMembershipResult,
    devTaskProjectResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, due_at, project_id, project:projects(name)",
        { count: "exact" }
      )
      .eq("assignee_id", user.id)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(TASK_DISPLAY_LIMIT),
    supabase
      .from("projects")
      .select(
        "id, name, expected_end_at, company:companies(name), pm:users!projects_pm_id_fkey(name, email)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    dealsPromise,
    // Developer scoping (same union as /dashboard/projects): team
    // memberships + projects where they have a task assigned. Fired
    // in parallel; we only consume the results when isDeveloper.
    isDeveloper
      ? supabase
          .from("project_team_members")
          .select("project_id")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
    isDeveloper
      ? supabase
          .from("tasks")
          .select("project_id")
          .eq("assignee_id", user.id)
          .not("project_id", "is", null)
      : Promise.resolve({ data: [] as { project_id: string | null }[] }),
  ]);

  const openTasks = (tasksResult.data ?? []) as OpenTaskRow[];
  const openTasksTotal = tasksResult.count ?? openTasks.length;
  const moreTasks = Math.max(0, openTasksTotal - openTasks.length);

  let activeProjects = (projectsResult.data ?? []) as ActiveProjectRow[];

  // For developers, narrow Active Projects (and the downstream KPI count)
  // to projects they reach via team membership OR a task assignment.
  // Mirrors /dashboard/projects so the two pages don't disagree.
  if (isDeveloper) {
    const allowedIds = new Set<string>();
    for (const m of devMembershipResult.data ?? []) {
      allowedIds.add(m.project_id);
    }
    for (const t of devTaskProjectResult.data ?? []) {
      if (t.project_id) allowedIds.add(t.project_id);
    }
    activeProjects = activeProjects.filter((p) => allowedIds.has(p.id));
  }

  const activeProjectIds = activeProjects.map((p) => p.id);

  const milestoneStats = new Map<string, { total: number; completed: number }>();
  if (activeProjectIds.length > 0) {
    const { data: milestones } = await supabase
      .from("milestones")
      .select("project_id, status")
      .in("project_id", activeProjectIds);
    for (const m of milestones ?? []) {
      const stat = milestoneStats.get(m.project_id) ?? {
        total: 0,
        completed: 0,
      };
      stat.total += 1;
      if (m.status === "completed") stat.completed += 1;
      milestoneStats.set(m.project_id, stat);
    }
  }

  const pipelineDeals = (dealsResult?.data ?? []) as PipelineDeal[];
  const pipelineByStage = new Map<
    DealStage,
    { count: number; inr: number; usd: number }
  >();
  for (const stage of DEAL_STAGE_ORDER) {
    pipelineByStage.set(stage, { count: 0, inr: 0, usd: 0 });
  }
  for (const d of pipelineDeals) {
    const stat = pipelineByStage.get(d.stage);
    if (!stat) continue;
    stat.count += 1;
    stat.inr += d.value_inr ? Number(d.value_inr) : 0;
    stat.usd += d.value_usd ? Number(d.value_usd) : 0;
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const openTasksCount = openTasks.length + moreTasks;
  const activeProjectsCount = activeProjects.length;
  const pipelineCount = pipelineDeals.length;
  let pipelineInr = 0;
  let pipelineUsd = 0;
  for (const d of pipelineDeals) {
    pipelineInr += d.value_inr ? Number(d.value_inr) : 0;
    pipelineUsd += d.value_usd ? Number(d.value_usd) : 0;
  }

  const pipelineValue =
    pipelineInr > 0
      ? inrFormatter.format(pipelineInr)
      : pipelineUsd > 0
      ? usdFormatter.format(pipelineUsd)
      : "—";

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${displayName}.`}
      />

      {/* ── KPI tiles per spec ──────────────────────────────────────── */}
      <div
        className={`grid grid-cols-2 gap-4 ${
          canSeePipeline ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <KpiTile
          accent="blue"
          label="My open tasks"
          value={<span className="font-numeric">{openTasksCount}</span>}
          helper="Across all your assignments"
        />
        <KpiTile
          accent="green"
          label="Active projects"
          value={<span className="font-numeric">{activeProjectsCount}</span>}
          helper="In flight right now"
        />
        {canSeePipeline ? (
          <>
            {/*
              KPI accent order mirrors the Dashboard.html reference: b/g/a/v.
              Position 3 (amber) = the currency value tile; position 4
              (violet) = the count of active deals.
            */}
            <KpiTile
              accent="amber"
              label="Pipeline value"
              value={
                <span className="font-numeric text-[22px]">{pipelineValue}</span>
              }
              helper={
                pipelineInr > 0 && pipelineUsd > 0
                  ? `+ ${usdFormatter.format(pipelineUsd)}`
                  : "Across all open stages"
              }
            />
            <KpiTile
              accent="violet"
              label="Pipeline deals"
              value={<span className="font-numeric">{pipelineCount}</span>}
              helper="Open opportunities"
            />
          </>
        ) : (
          <KpiTile
            accent="violet"
            label="Your role"
            value={
              <span className="capitalize text-[22px]">{role ?? "—"}</span>
            }
            helper="Access scoped to your role"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My open tasks</CardTitle>
            <CardDescription>
              Assigned to you, sorted by due date. Overdue first.
            </CardDescription>
            <CardAction>
              <Link
                href="/dashboard/tasks"
                className="text-[13px] font-semibold text-blue-700 underline-offset-2 hover:underline"
              >
                View all
              </Link>
            </CardAction>
          </CardHeader>
          {openTasks.length === 0 ? (
            <CardContent>
              <p className="text-[14px] text-ink-500">
                No open tasks assigned to you.
              </p>
            </CardContent>
          ) : (
            <>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Task</TableHead>
                      <TableHead>Status</TableHead>
                      {/*
                        Card sits in a 2-col grid at lg+. At lg the column is
                        tight, so Priority + Due hide; Due collapses into the
                        title's secondary line. They return at xl+ where each
                        card has ~570px to play with.
                      */}
                      <TableHead className="hidden xl:table-cell">
                        Priority
                      </TableHead>
                      <TableHead className="hidden pr-6 xl:table-cell">
                        Due
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTasks.map((task) => {
                      const status = TASK_STATUS[task.status];
                      const priority = TASK_PRIORITY[task.priority];
                      const overdue = task.due_at
                        ? new Date(task.due_at).getTime() < now
                        : false;
                      const dueLabel = task.due_at
                        ? formatDate(task.due_at)
                        : null;
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="pl-6 whitespace-normal">
                            <Link
                              href={`/dashboard/projects/${task.project_id}`}
                              className="block hover:underline"
                            >
                              <div className="font-semibold leading-tight text-ink-900">
                                {task.title}
                              </div>
                              <div className="text-[12px] text-ink-400">
                                <span>{task.project?.name ?? "—"}</span>
                                {/*
                                  Due collapses here only at lg (when the Due
                                  column itself is hidden). At <lg the card
                                  is full-width and the Due column shows; at
                                  xl+ same.
                                */}
                                {dueLabel ? (
                                  <span className="xl:hidden">
                                    {" · "}
                                    <span
                                      className={
                                        overdue
                                          ? "font-numeric font-semibold text-red-600"
                                          : "font-numeric"
                                      }
                                    >
                                      Due {dueLabel}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={status.variant}
                              className={status.className}
                            >
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <Badge
                              variant={priority.variant}
                              className={priority.className}
                            >
                              {priority.label}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`hidden xl:table-cell ${
                              overdue
                                ? "pr-6 font-numeric font-semibold text-red-600"
                                : "pr-6 font-numeric text-ink-500"
                            }`}
                          >
                            {dueLabel ?? "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
              {moreTasks > 0 ? (
                <CardContent className="border-t border-line pt-3 text-[12px] text-ink-500">
                  …and {moreTasks} more open task{moreTasks === 1 ? "" : "s"}.
                </CardContent>
              ) : null}
            </>
          )}
        </Card>

        {/*
          Right column per the Dashboard.html reference: ONE card holding
          two tables separated by a hairline. Active projects on top, then
          a `border-t border-line` divider, then Pipeline snapshot — only
          when the role can see it. This replaces the previous pattern of
          a separate full-width Pipeline card below the grid.
        */}
        <Card>
          <CardHeader>
            <CardTitle>Active projects</CardTitle>
            <CardDescription>
              Engagements currently in flight.
            </CardDescription>
            <CardAction>
              <Link
                href="/dashboard/projects"
                className="text-[13px] font-semibold text-blue-700 underline-offset-2 hover:underline"
              >
                View all
              </Link>
            </CardAction>
          </CardHeader>
          {activeProjects.length === 0 ? (
            <CardContent>
              <p className="text-[14px] text-ink-500">
                No active projects.
              </p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProjects.map((project) => {
                    const stat = milestoneStats.get(project.id) ?? {
                      total: 0,
                      completed: 0,
                    };
                    const pastDue = project.expected_end_at
                      ? new Date(project.expected_end_at).getTime() < now
                      : false;
                    const pct =
                      stat.total > 0
                        ? Math.round((stat.completed / stat.total) * 100)
                        : 0;
                    const targetLabel = project.expected_end_at
                      ? formatDate(project.expected_end_at)
                      : null;
                    // The dashboard query filters `status = 'active'`, so
                    // every row here is by definition Active. We render the
                    // PROJECT_STATUS["active"] badge directly rather than
                    // expanding the SELECT — a presentational match for the
                    // reference structure without a query change.
                    const statusVisual = PROJECT_STATUS["active"];
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="pl-6 whitespace-normal">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="block hover:underline"
                          >
                            <div className="font-semibold leading-tight text-ink-900">
                              {project.name}
                            </div>
                            <div className="text-[12px] text-ink-400">
                              <span>
                                {project.company?.name ?? (
                                  <span className="italic text-ink-400">
                                    Internal
                                  </span>
                                )}
                              </span>
                              {targetLabel ? (
                                <>
                                  {" · "}
                                  <span
                                    className={
                                      pastDue
                                        ? "font-numeric font-semibold text-red-600"
                                        : "font-numeric"
                                    }
                                  >
                                    due {targetLabel}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusVisual.variant}
                            className={statusVisual.className}
                          >
                            {statusVisual.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex items-center gap-3">
                            <div className="progress-track w-20 shrink-0">
                              <div
                                className="progress-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-numeric text-[12px] text-ink-500">
                              {stat.completed}/{stat.total}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          )}

          {/*
            Pipeline snapshot lives INSIDE the same card. Separated by a
            single hairline. Role-gated — devs/clients see only Active
            projects above and no pipeline below.
          */}
          {canSeePipeline ? (
            <>
              <div className="border-t border-line" />
              <CardHeader>
                <CardTitle>Pipeline snapshot</CardTitle>
                <CardDescription>Deals by stage.</CardDescription>
                <CardAction>
                  <Link
                    href="/dashboard/deals"
                    className="text-[13px] font-semibold text-blue-700 underline-offset-2 hover:underline"
                  >
                    View pipeline
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Stage</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead className="pr-6">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEAL_STAGE_ORDER.map((stage) => {
                      const stageVisual = DEAL_STAGE[stage];
                      const stat = pipelineByStage.get(stage) ?? {
                        count: 0,
                        inr: 0,
                        usd: 0,
                      };
                      return (
                        <TableRow key={stage}>
                          <TableCell className="pl-6">
                            <Badge
                              variant={stageVisual.variant}
                              className={stageVisual.className}
                            >
                              {stageVisual.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-numeric text-ink-700">
                            {stat.count}
                          </TableCell>
                          <TableCell className="pr-6 font-numeric text-ink-700">
                            {formatStageTotal(stat.inr, stat.usd)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </>
          ) : null}
        </Card>
      </div>
    </Page>
  );
}
