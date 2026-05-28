import Link from "next/link";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    milestoneStats = new Map(projectIds.map((id) => [id, { total: 0, completed: 0 }]));
    for (const m of milestoneRows ?? []) {
      const bucket = milestoneStats.get(m.project_id);
      if (!bucket) continue;
      bucket.total += 1;
      if (m.status === "completed") bucket.completed += 1;
    }
  }

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

      <Card>
        {!projects || projects.length === 0 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">No projects yet</CardTitle>
              <CardDescription>
                {canEdit
                  ? "No projects yet. Create your first one."
                  : "No projects to show yet."}
              </CardDescription>
            </CardHeader>
            {canEdit ? (
              <CardContent>
                <Button render={<Link href="/dashboard/projects/new" />}>
                  Create project
                </Button>
              </CardContent>
            ) : null}
          </>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead className="pr-4">Target end</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const status = PROJECT_STATUS[project.status];
                  const pmDisplay = userDisplay(project.pm, "—");
                  const stats = milestoneStats.get(project.id);
                  const progressLabel = stats && stats.total > 0
                    ? `${stats.completed} / ${stats.total} milestones`
                    : "—";
                  return (
                    <TableRow key={project.id}>
                      <TableCell className="pl-4 font-medium">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.company?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status.variant}
                          className={status.className}
                        >
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {progressLabel}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pmDisplay}
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">
                        {project.expected_end_at
                          ? dateFormatter.format(
                              new Date(project.expected_end_at)
                            )
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
    </Page>
  );
}
