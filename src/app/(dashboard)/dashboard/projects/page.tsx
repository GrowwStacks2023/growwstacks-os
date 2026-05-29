import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { ResponsiveList, type ResponsiveRow } from "@/components/responsive-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canEditProjectArea } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { userDisplay } from "@/lib/display";
import { PROJECT_STATUS } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function ProjectsPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();
  const canEdit = canEditProjectArea(role);

  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, name, status, expected_end_at, company:companies(name), pm:users(name, email)"
    )
    .order("created_at", { ascending: false });

  // Milestone progress per project (admin/sales/pm/dev all benefit from
  // the summary; sales especially needs it as their read-only signal of
  // how delivery is going). One ranged query, group client-side.
  const projectIds = (projects ?? []).map((p) => p.id);
  let milestoneStats = new Map<
    string,
    { total: number; completed: number }
  >();
  if (projectIds.length > 0) {
    const { data: milestoneRows } = await supabase
      .from("milestones")
      .select("project_id, status")
      .in("project_id", projectIds);
    milestoneStats = new Map(
      projectIds.map((id) => [id, { total: 0, completed: 0 }])
    );
    for (const m of milestoneRows ?? []) {
      const bucket = milestoneStats.get(m.project_id);
      if (!bucket) continue;
      bucket.total += 1;
      if (m.status === "completed") bucket.completed += 1;
    }
  }

  const rows: ResponsiveRow[] = (projects ?? []).map((project) => {
    const status = PROJECT_STATUS[project.status];
    const pmDisplay = userDisplay(project.pm, "—");
    const stats = milestoneStats.get(project.id);
    const pct =
      stats && stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
    const progressNode =
      stats && stats.total > 0 ? (
        <div className="flex min-w-[120px] flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-[12px] text-ink-500">
            <span className="font-numeric">
              {stats.completed}/{stats.total}
            </span>
            <span className="font-numeric text-ink-400">{pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <span className="text-ink-400">—</span>
      );

    return {
      id: project.id,
      href: `/dashboard/projects/${project.id}`,
      cells: {
        name: (
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="font-semibold text-ink-900 hover:text-blue-700"
          >
            {project.name}
          </Link>
        ),
        company: (
          <span className="text-ink-500">{project.company?.name ?? "—"}</span>
        ),
        status: (
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        ),
        progress: progressNode,
        pm: <span className="text-ink-500">{pmDisplay}</span>,
        target_end: (
          <span className="font-numeric text-ink-500">
            {project.expected_end_at
              ? dateFormatter.format(new Date(project.expected_end_at))
              : "—"}
          </span>
        ),
      },
    };
  });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects" },
        ]}
        title="Projects"
        description={
          canEdit
            ? "Engagements in flight."
            : "Engagements in flight — read-only view."
        }
        action={
          canEdit ? (
            <Button render={<Link href="/dashboard/projects/new" />}>
              New project
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load projects: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <ResponsiveList
        columns={[
          { key: "name", label: "Name", primary: true, widthHint: "26%" },
          { key: "company", label: "Company" },
          { key: "status", label: "Status" },
          { key: "progress", label: "Progress" },
          { key: "pm", label: "PM" },
          { key: "target_end", label: "Target end" },
        ]}
        rows={rows}
        empty={
          <div className="flex flex-col items-center gap-3">
            <p className="text-ink-700">
              {canEdit ? "No projects yet." : "No projects to show yet."}
            </p>
            {canEdit ? (
              <Button render={<Link href="/dashboard/projects/new" />}>
                Spin up your first project
              </Button>
            ) : null}
          </div>
        }
      />
    </Page>
  );
}
