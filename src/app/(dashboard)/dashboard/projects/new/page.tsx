import Link from "next/link";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form";
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
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: "New project" },
        ]}
      />
      <FormCard
        title="New project"
        subtitle="Spin up a delivery engagement for one of your companies. Add milestones and tasks after the project exists."
      >
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
            <p className="text-[14px] text-ink-500">
              Create a company first — every project has to belong to one.
            </p>
            <div>
              <Button render={<Link href="/dashboard/companies/new" />}>
                Create company
              </Button>
            </div>
          </div>
        )}
      </FormCard>
    </Page>
  );
}
