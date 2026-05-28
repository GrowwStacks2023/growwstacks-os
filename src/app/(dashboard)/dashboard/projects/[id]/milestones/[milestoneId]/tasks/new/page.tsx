import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { NewTaskForm } from "./new-task-form";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const { id, milestoneId } = await params;
  const supabase = await createClient();

  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, name, project_id, project:projects(name)")
    .eq("id", milestoneId)
    .maybeSingle();

  // Defence-in-depth: the route is /projects/[id]/milestones/[milestoneId] —
  // if those two ids disagree, 404 rather than letting the trigger reject it
  // later.
  if (!milestone || milestone.project_id !== id) {
    notFound();
  }

  const { data: assignees } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[560px]">
        <CardHeader>
          <CardTitle className="text-base">New task</CardTitle>
          <CardDescription>
            Under milestone{" "}
            <span className="font-medium">{milestone.name}</span>
            {milestone.project?.name ? (
              <>
                {" "}· in <span className="font-medium">
                  {milestone.project.name}
                </span>
              </>
            ) : null}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewTaskForm
            projectId={id}
            milestoneId={milestoneId}
            assignees={assignees ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
