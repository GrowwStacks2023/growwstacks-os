import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditContactForm } from "./edit-contact-form";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!canEdit(role, "contact")) {
    redirect(`/dashboard/contacts/${id}`);
  }

  const supabase = await createClient();
  // Fetch the contact + the company picker options in parallel.
  const [contactRes, companiesRes] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, name, company_id, email, phone, whatsapp, role, is_primary"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("companies").select("id, name").order("name", { ascending: true }),
  ]);

  const contact = contactRes.data;
  if (!contact) notFound();

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts", href: "/dashboard/contacts" },
          {
            label: contact.name,
            href: `/dashboard/contacts/${contact.id}`,
          },
          { label: "Edit" },
        ]}
      />
      <FormCard
        title={`Edit ${contact.name}`}
        subtitle="Update this contact's details. Changes are logged to the activity feed."
      >
        <EditContactForm
          contact={{
            id: contact.id,
            name: contact.name,
            companyId: contact.company_id,
            email: contact.email,
            phone: contact.phone,
            whatsapp: contact.whatsapp,
            role: contact.role,
            isPrimary: contact.is_primary,
          }}
          companies={companiesRes.data ?? []}
        />
      </FormCard>
    </Page>
  );
}
