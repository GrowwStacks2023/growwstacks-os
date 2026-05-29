import Link from "next/link";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();

  // contacts: include company_id so the form can auto-fill the project's
  // company from the chosen contact.
  const [{ data: pmCandidates }, { data: contacts }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["pm", "admin"])
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, name, company_id, company:companies(name)")
      .order("name", { ascending: true }),
  ]);

  const hasContacts = (contacts?.length ?? 0) > 0;

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
        subtitle="Spin up a delivery engagement. Pick the primary contact — their company becomes the project's company automatically."
      >
        {hasContacts ? (
          <NewProjectForm
            pmCandidates={pmCandidates ?? []}
            contacts={(contacts ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              companyId: c.company_id ?? null,
              companyName: c.company?.name ?? null,
            }))}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-ink-500">
              Create a contact first — every project needs one. The contact&apos;s
              company fills in automatically.
            </p>
            <div>
              <Button render={<Link href="/dashboard/contacts/new" />}>
                Create contact
              </Button>
            </div>
          </div>
        )}
      </FormCard>
    </Page>
  );
}
