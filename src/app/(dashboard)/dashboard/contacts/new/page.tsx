import { Page, PageHeader } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
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
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: "New contact" },
        ]}
        title="New contact"
        description="A contact can stand alone or belong to a company."
      />
      <Card className="w-full max-w-[640px]">
        <CardContent className="pt-6">
          <NewContactForm companies={companies ?? []} />
        </CardContent>
      </Card>
    </Page>
  );
}
