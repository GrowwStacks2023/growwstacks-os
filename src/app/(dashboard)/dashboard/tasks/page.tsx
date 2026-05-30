import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { ResponsiveList, type ResponsiveRow } from "@/components/responsive-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canCreate } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { userDisplay } from "@/lib/display";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Scope = "mine" | "all";

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
  title: string;
  status: Database["public"]["Enums"]["task_status"];
  priority: Database["public"]["Enums"]["task_priority"];
  due_at: string | null;
  project_id: string | null;
  milestone_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  assignee: { name: string | null; email: string } | null;
};

export default async function TasksPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ scope?: string }>;
}) {
  const supabase = await createClient();
  const role = await getCurrentRole();
  const mayCreate = canCreate(role, "task");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { scope: scopeParam } = await searchParams;
  // Developers are forced to "mine" — they don't get an "all tasks" view
  // even via URL tampering. Sales can use either scope; admin/pm too.
  const requestedScope: Scope = scopeParam === "all" ? "all" : "mine";
  const scope: Scope = role === "developer" ? "mine" : requestedScope;
  const showScopeToggle = role !== "developer";

  // Fetch the task rows in one query. The Postgres FK ambiguity between
  // tasks.assignee_id and tasks.pm_id forces an explicit FK-hint on the
  // user join (per the Task 8 finding).
  let q = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_at, project_id, milestone_id, deal_id, contact_id, assignee:users!tasks_assignee_id_fkey(name, email)"
    );

  // "My tasks" = assignee OR pm. We push the OR into the query so the row
  // count returned is already scoped (avoids a client-side filter pass).
  // "All tasks" is whatever RLS lets the caller see — no extra filter.
  if (scope === "mine" && user) {
    q = q.or(`assignee_id.eq.${user.id},pm_id.eq.${user.id}`);
  }

  const { data: tasks, error } = await q
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (tasks ?? []) as TaskRow[];

  // ─── Batch context lookups to avoid N+1 ──────────────────────────────
  // Pattern mirrors the dashboard page: collect the distinct ids we need
  // names for, fire three .in() queries in parallel, build lookup maps.
  const projectIds = new Set<string>();
  const milestoneIds = new Set<string>();
  const dealIds = new Set<string>();
  const contactIds = new Set<string>();
  for (const t of rows) {
    if (t.project_id) projectIds.add(t.project_id);
    if (t.milestone_id) milestoneIds.add(t.milestone_id);
    if (t.deal_id) dealIds.add(t.deal_id);
    if (t.contact_id) contactIds.add(t.contact_id);
  }

  const [projectsRes, milestonesRes, dealsRes, contactsRes] = await Promise.all([
    projectIds.size > 0
      ? supabase
          .from("projects")
          .select("id, name")
          .in("id", Array.from(projectIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    milestoneIds.size > 0
      ? supabase
          .from("milestones")
          .select("id, name")
          .in("id", Array.from(milestoneIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    dealIds.size > 0
      ? supabase
          .from("deals")
          .select("id, title")
          .in("id", Array.from(dealIds))
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    contactIds.size > 0
      ? supabase
          .from("contacts")
          .select("id, name")
          .in("id", Array.from(contactIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const projectsById = new Map(
    (projectsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const milestonesById = new Map(
    (milestonesRes.data ?? []).map((m) => [m.id, m.name])
  );
  const dealsById = new Map(
    (dealsRes.data ?? []).map((d) => [d.id, d.title])
  );
  const contactsById = new Map(
    (contactsRes.data ?? []).map((c) => [c.id, c.name])
  );

  type ContextDescriptor = {
    label: string;
    href: string | null;
  };

  // Pick the highest-signal context for the row. Order: milestone > project
  // > deal > contact. (A milestone implies its project, but the milestone
  // name is more specific so we lead with it.)
  function describeContext(t: TaskRow): ContextDescriptor {
    if (t.milestone_id && t.project_id) {
      const project = projectsById.get(t.project_id) ?? "Project";
      const milestone = milestonesById.get(t.milestone_id) ?? "Milestone";
      return {
        label: `${project} · ${milestone}`,
        href: `/dashboard/projects/${t.project_id}/milestones/${t.milestone_id}`,
      };
    }
    if (t.project_id) {
      return {
        label: `Project: ${projectsById.get(t.project_id) ?? "Project"}`,
        href: `/dashboard/projects/${t.project_id}`,
      };
    }
    if (t.deal_id) {
      return {
        label: `Deal: ${dealsById.get(t.deal_id) ?? "Deal"}`,
        href: `/dashboard/deals/${t.deal_id}`,
      };
    }
    if (t.contact_id) {
      return {
        label: `Contact: ${contactsById.get(t.contact_id) ?? "Contact"}`,
        href: `/dashboard/contacts/${t.contact_id}`,
      };
    }
    return { label: "—", href: null };
  }

  const myActive = scope === "mine";

  const listRows: ResponsiveRow[] = rows.map((t) => {
    const status = TASK_STATUS[t.status];
    const priority = TASK_PRIORITY[t.priority];
    const ctx = describeContext(t);
    return {
      id: t.id,
      href: `/dashboard/tasks/${t.id}`,
      cells: {
        title: (
          <Link
            href={`/dashboard/tasks/${t.id}`}
            className="font-semibold text-ink-900 hover:text-blue-700"
          >
            {t.title}
          </Link>
        ),
        context: ctx.href ? (
          <Link
            href={ctx.href}
            className="text-muted-foreground hover:text-foreground"
          >
            {ctx.label}
          </Link>
        ) : (
          <span className="text-muted-foreground">{ctx.label}</span>
        ),
        assignee: (
          <span className="text-muted-foreground">
            {userDisplay(t.assignee, "Unassigned")}
          </span>
        ),
        priority: (
          <Badge variant={priority.variant} className={priority.className}>
            {priority.label}
          </Badge>
        ),
        status: (
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        ),
        due: <span className="text-muted-foreground">{formatDate(t.due_at)}</span>,
      },
    };
  });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks" },
        ]}
        title="Tasks"
        description="Everything assigned to you or that you own — across projects, deals, and contacts."
        action={
          <div className="flex items-center gap-2">
            {showScopeToggle ? (
              <div className="inline-flex rounded-md border border-border bg-card p-1 text-sm">
                <Button
                  size="sm"
                  variant={myActive ? "secondary" : "ghost"}
                  render={<Link href="/dashboard/tasks?scope=mine" />}
                >
                  My tasks
                </Button>
                <Button
                  size="sm"
                  variant={!myActive ? "secondary" : "ghost"}
                  render={<Link href="/dashboard/tasks?scope=all" />}
                >
                  All tasks
                </Button>
              </div>
            ) : null}
            {mayCreate ? (
              <Button render={<Link href="/dashboard/tasks/new" />}>
                New task
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load tasks: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <ResponsiveList
        columns={[
          { key: "title", label: "Title", primary: true, widthHint: "28%" },
          { key: "context", label: "Context" },
          { key: "assignee", label: "Assignee" },
          { key: "priority", label: "Priority" },
          { key: "status", label: "Status" },
          { key: "due", label: "Due" },
        ]}
        rows={listRows}
        empty={
          myActive
            ? "No tasks assigned to you yet. Add a task to a project, deal, or contact."
            : "No tasks visible to you yet."
        }
      />
    </Page>
  );
}
