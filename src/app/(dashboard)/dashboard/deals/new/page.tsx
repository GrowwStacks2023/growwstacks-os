import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { NewDealForm } from "./new-deal-form";

export default async function NewDealPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: contacts }, { data: owners }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true }),
      // Contacts are listed flat with their company name appended for context.
      // No client-side filter by company — keeps the form simple, and the
      // contact dropdown is optional anyway.
      supabase
        .from("contacts")
        .select("id, name, company:companies(name)")
        .order("name", { ascending: true }),
      supabase
        .from("users")
        .select("id, name, email")
        .in("role", ["sales", "admin", "pm"])
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

  const hasCompanies = (companies?.length ?? 0) > 0;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deals", href: "/dashboard/deals" },
          { label: "New deal" },
        ]}
        title="New deal"
        description="Log an opportunity in the sales pipeline."
      />
      <Card className="w-full max-w-[640px]">
        <CardContent className="pt-6">
          {hasCompanies ? (
            <NewDealForm
              companies={companies ?? []}
              contacts={(contacts ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                companyName: c.company?.name ?? null,
              }))}
              owners={owners ?? []}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Create a company first — every deal has to belong to one.
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
