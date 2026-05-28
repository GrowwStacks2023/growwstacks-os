import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { NewMilestoneForm } from "./new-milestone-form";

export default async function NewMilestonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: maxRow } = await supabase
    .from("milestones")
    .select("sequence")
    .eq("project_id", id)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (maxRow?.sequence ?? 0) + 1;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.name, href: `/dashboard/projects/${id}` },
          { label: "New milestone" },
        ]}
        title="New milestone"
        description={
          <>
            Add a phase to <span className="font-medium">{project.name}</span>.
          </>
        }
      />
      <Card className="w-full max-w-[640px]">
        <CardContent className="pt-6">
          <NewMilestoneForm projectId={id} nextSequence={nextSequence} />
        </CardContent>
      </Card>
    </Page>
  );
}
