import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex justify-center">
      <Card className="w-full max-w-[560px]">
        <CardHeader>
          <CardTitle className="text-base">New milestone</CardTitle>
          <CardDescription>
            Add a phase to <span className="font-medium">{project.name}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewMilestoneForm projectId={id} nextSequence={nextSequence} />
        </CardContent>
      </Card>
    </div>
  );
}
