import { notFound } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
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
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.name, href: `/dashboard/projects/${id}` },
          { label: "New milestone" },
        ]}
      />
      <FormCard
        title="New milestone"
        subtitle={
          <>
            Add a phase to <span className="font-semibold text-ink-900">{project.name}</span>.
            Sequence determines the order on the project page.
          </>
        }
      >
        <NewMilestoneForm projectId={id} nextSequence={nextSequence} />
      </FormCard>
    </Page>
  );
}
