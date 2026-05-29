import Link from "next/link";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

import { NewDealForm } from "./new-deal-form";

export default async function NewDealPage() {
  const supabase = await createClient();

  // contacts: flat list with company id + name attached. The deal form
  // auto-fills company from the chosen contact, so we need company_id —
  // not just the name — to pass into the action.
  const [{ data: contacts }, { data: owners }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, company_id, company:companies(name)")
      .order("name", { ascending: true }),
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["sales", "admin", "pm"])
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const hasContacts = (contacts?.length ?? 0) > 0;

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deals", href: "/dashboard/deals" },
          { label: "New deal" },
        ]}
      />
      <FormCard
        title="New deal"
        subtitle="Log an opportunity in the sales pipeline. Stage starts at New — drag it on the Board view to move it forward."
      >
        {hasContacts ? (
          <NewDealForm
            contacts={(contacts ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              companyId: c.company_id ?? null,
              companyName: c.company?.name ?? null,
            }))}
            owners={owners ?? []}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-ink-500">
              Create a contact first — every deal needs one. The contact&apos;s
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
