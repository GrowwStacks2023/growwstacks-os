import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditDealForm } from "./edit-deal-form";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!canEdit(role, "deal")) {
    redirect(`/dashboard/deals/${id}`);
  }

  const supabase = await createClient();
  const [dealRes, contactsRes, ownersRes] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, title, description, stage, source, value_inr, value_usd, owner_id, contact_id, company_id, company:companies(name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, company_id, company:companies(name)")
      .order("name", { ascending: true }),
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["sales", "admin", "pm"])
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const deal = dealRes.data;
  if (!deal) notFound();

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deals", href: "/dashboard/deals" },
          {
            label: deal.title,
            href: `/dashboard/deals/${deal.id}`,
          },
          { label: "Edit" },
        ]}
      />
      <FormCard
        title={`Edit ${deal.title}`}
        subtitle={
          deal.company?.name ? (
            <>
              Deal · <span className="font-semibold text-ink-900">{deal.company.name}</span>
            </>
          ) : (
            "Update the deal record."
          )
        }
      >
        <EditDealForm
          deal={{
            id: deal.id,
            title: deal.title,
            description: deal.description,
            stage: deal.stage,
            source: deal.source,
            ownerId: deal.owner_id,
            contactId: deal.contact_id,
            companyId: deal.company_id,
            valueInr: deal.value_inr,
            valueUsd: deal.value_usd,
          }}
          contacts={(contactsRes.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            companyId: c.company_id ?? null,
            companyName: c.company?.name ?? null,
          }))}
          owners={ownersRes.data ?? []}
        />
      </FormCard>
    </Page>
  );
}
