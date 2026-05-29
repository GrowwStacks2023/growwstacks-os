import Link from "next/link";
import { redirect } from "next/navigation";

import { Page, PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
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

  // Fire independent queries in parallel. The active-projects query is NOT
  // role-filtered — RLS already scopes it (developers see only projects they
  // have a task in via user_has_task_in_project; admin/sales/pm see all).
  const dealsPromise = canSeePipeline
    ? supabase.from("deals").select("stage, value_inr, value_usd")
    : null;

  const [tasksResult, projectsResult, dealsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, due_at, project_id, project:projects(name)",
        { count: "exact" }
      )
      .eq("assignee_id", user.id)
      .neq("status", "done")
      // due_at ascending + nulls last gives us: overdue (past dates) first,
      // then upcoming soonest-first, then undated tasks at the bottom.
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(TASK_DISPLAY_LIMIT),
    supabase
      .from("projects")
      .select(
        "id, name, expected_end_at, company:companies(name), pm:users(name, email)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    dealsPromise,
  ]);

  const openTasks = (tasksResult.data ?? []) as OpenTaskRow[];
  const openTasksTotal = tasksResult.count ?? openTasks.length;
  const moreTasks = Math.max(0, openTasksTotal - openTasks.length);

  const activeProjects = (projectsResult.data ?? []) as ActiveProjectRow[];
  const activeProjectIds = activeProjects.map((p) => p.id);

  // Single milestones query for all active projects — group in memory so we
  // never query inside the render loop. This is the N+1 avoidance.
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

  // Server Component renders once per request, so reading "now" once is
  // deterministic for this render. The purity rule can't tell Server from
  // Client Components apart, so silence it here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  // KPI tile values — blue numbers, green positive-delta dot where there's
  // genuinely something to celebrate.
  const openTasksCount = openTasks.length + moreTasks;
  const activeProjectsCount = activeProjects.length;
  const pipelineCount = pipelineDeals.length;
  let pipelineInr = 0;
  let pipelineUsd = 0;
  for (const d of pipelineDeals) {
    pipelineInr += d.value_inr ? Number(d.value_inr) : 0;
    pipelineUsd += d.value_usd ? Number(d.value_usd) : 0;
  }

  return (
    <Page>
      {/* Dashboard root — no breadcrumbs since this IS Dashboard. */}
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${displayName}.`}
      />

      {/* ── KPI tiles ─────────────────────────────────────────────────
         Three (or four with pipeline) clean tiles using big blue numbers
         in the display font. Active-projects tile gets a small green
         dot — the only positive-state accent on the page. */}
      <div
        className={`grid grid-cols-2 gap-4 ${
          canSeePipeline ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              My open tasks
            </div>
            <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.012em] text-brand-700">
              {openTasksCount}
            </div>
            <div className="text-[13px] text-muted-foreground">
              Across all your assignments
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <span
                aria-hidden
                className="size-2 rounded-full bg-success-500"
              />
              Active projects
            </div>
            <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.012em] text-brand-700">
              {activeProjectsCount}
            </div>
            <div className="text-[13px] text-muted-foreground">In flight right now</div>
          </CardContent>
        </Card>
        {canSeePipeline ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-1.5">
                <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Pipeline deals
                </div>
                <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.012em] text-brand-700">
                  {pipelineCount}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Open opportunities
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1.5">
                <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Pipeline value
                </div>
                <div className="font-numeric text-[18px] font-semibold leading-tight text-brand-700">
                  {pipelineInr > 0 ? inrFormatter.format(pipelineInr) : "—"}
                </div>
                <div className="font-numeric text-[14px] leading-tight text-muted-foreground">
                  {pipelineUsd > 0 ? usdFormatter.format(pipelineUsd) : "—"}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-1.5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Your role
              </div>
              <div className="font-display text-[24px] font-semibold capitalize leading-none text-brand-700">
                {role ?? "—"}
              </div>
              <div className="text-[13px] text-muted-foreground">
                Access scoped to your role
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My open tasks</CardTitle>
            <CardDescription>
              Assigned to you, sorted by due date. Overdue first.
            </CardDescription>
          </CardHeader>
          {openTasks.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No open tasks assigned to you.
              </p>
            </CardContent>
          ) : (
            <>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="pr-4">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTasks.map((task) => {
                      const status = TASK_STATUS[task.status];
                      const priority = TASK_PRIORITY[task.priority];
                      const overdue = task.due_at
                        ? new Date(task.due_at).getTime() < now
                        : false;
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="pl-4">
                            <Link
                              href={`/dashboard/projects/${task.project_id}`}
                              className="block hover:underline"
                            >
                              <div className="font-medium leading-tight">
                                {task.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {task.project?.name ?? "—"}
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
                          <TableCell>
                            <Badge
                              variant={priority.variant}
                              className={priority.className}
                            >
                              {priority.label}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={
                              overdue
                                ? "pr-4 font-medium text-red-600 dark:text-red-400"
                                : "pr-4 text-muted-foreground"
                            }
                          >
                            {task.due_at ? formatDate(task.due_at) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
              {moreTasks > 0 ? (
                <CardContent className="border-t pt-3 text-xs text-muted-foreground">
                  …and {moreTasks} more open task{moreTasks === 1 ? "" : "s"}.
                </CardContent>
              ) : null}
            </>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active projects</CardTitle>
            <CardDescription>
              Engagements currently in flight.{" "}
              <Link
                href="/dashboard/projects"
                className="underline hover:text-foreground"
              >
                View all
              </Link>
              .
            </CardDescription>
          </CardHeader>
          {activeProjects.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No active projects.
              </p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Project</TableHead>
                    <TableHead>PM</TableHead>
                    <TableHead>Milestones</TableHead>
                    <TableHead className="pr-4">Target end</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProjects.map((project) => {
                    const stat = milestoneStats.get(project.id) ?? {
                      total: 0,
                      completed: 0,
                    };
                    const pmDisplay = userDisplay(project.pm, "—");
                    const pastDue = project.expected_end_at
                      ? new Date(project.expected_end_at).getTime() < now
                      : false;
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="pl-4">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="block hover:underline"
                          >
                            <div className="font-medium leading-tight">
                              {project.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {project.company?.name ?? "—"}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {pmDisplay}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {stat.completed} of {stat.total}
                        </TableCell>
                        <TableCell
                          className={
                            pastDue
                              ? "pr-4 font-medium text-red-600 dark:text-red-400"
                              : "pr-4 text-muted-foreground"
                          }
                        >
                          {project.expected_end_at
                            ? formatDate(project.expected_end_at)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      </div>

      {canSeePipeline ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline snapshot</CardTitle>
            <CardDescription>
              Deals by stage.{" "}
              <Link
                href="/dashboard/deals"
                className="underline hover:text-foreground"
              >
                View pipeline
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Stage</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead className="pr-4">Total value</TableHead>
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
                      <TableCell className="pl-4">
                        <Badge
                          variant={stageVisual.variant}
                          className={stageVisual.className}
                        >
                          {stageVisual.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {stat.count}
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">
                        {formatStageTotal(stat.inr, stat.usd)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </Page>
  );
}
