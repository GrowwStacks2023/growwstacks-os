import Link from "next/link";

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
import { PROJECT_STATUS } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, name, status, expected_end_at, company:companies(name), pm:users(name, email)"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Engagements in flight.
          </p>
        </div>
        <Button render={<Link href="/dashboard/projects/new" />}>
          New project
        </Button>
      </div>

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
                No projects yet. Create your first one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/dashboard/projects/new" />}>
                Create project
              </Button>
            </CardContent>
          </>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead className="pr-4">Target end</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const status = PROJECT_STATUS[project.status];
                  const pmDisplay =
                    project.pm?.name ?? project.pm?.email ?? "—";
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
    </div>
  );
}
