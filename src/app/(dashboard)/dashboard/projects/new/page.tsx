import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: pmCandidates }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["pm", "admin"])
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const hasCompanies = (companies?.length ?? 0) > 0;

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[560px]">
        <CardHeader>
          <CardTitle className="text-base">New project</CardTitle>
          <CardDescription>
            Spin up a delivery engagement for one of your companies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasCompanies ? (
            <NewProjectForm
              companies={companies ?? []}
              pmCandidates={pmCandidates ?? []}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Create a company first — every project has to belong to one.
              </p>
              <div>
                <Button render={<Link href="/dashboard/companies/new" />}>
                  Create company
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
