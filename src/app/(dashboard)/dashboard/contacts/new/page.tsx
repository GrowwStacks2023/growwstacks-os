import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

import { NewContactForm } from "./new-contact-form";

export default async function NewContactPage() {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: "New contact" },
        ]}
      />
      <FormCard
        title="New contact"
        subtitle="A contact can stand alone or belong to a company. You can attach files and notes after creating."
      >
        <NewContactForm companies={companies ?? []} />
      </FormCard>
    </Page>
  );
}
