import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: pmCandidates }, { data: contacts }] =
    await Promise.all([
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
      // Flat list of contacts with company name appended for context. No
      // filtering by selected company — Raghav confirmed company and
      // contact are independent selections.
      supabase
        .from("contacts")
        .select("id, name, company:companies(name)")
        .order("name", { ascending: true }),
    ]);

  const hasCompanies = (companies?.length ?? 0) > 0;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: "New project" },
        ]}
        title="New project"
        description="Spin up a delivery engagement for one of your companies."
      />
      <Card className="w-full max-w-[640px]">
        <CardContent className="pt-6">
          {hasCompanies ? (
            <NewProjectForm
              companies={companies ?? []}
              pmCandidates={pmCandidates ?? []}
              contacts={(contacts ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                companyName: c.company?.name ?? null,
              }))}
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
    </Page>
  );
}
