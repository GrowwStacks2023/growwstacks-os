import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { ResponsiveList, type ResponsiveRow } from "@/components/responsive-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canCreate } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

export default async function ContactsPage() {
  const role = await getCurrentRole();
  const mayCreate = canCreate(role, "contact");
  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(
      "id, name, email, phone, whatsapp, is_primary, company:companies(name)"
    )
    .order("created_at", { ascending: false });

  const rows: ResponsiveRow[] = (contacts ?? []).map((c) => ({
    id: c.id,
    href: `/dashboard/contacts/${c.id}`,
    cells: {
      name: (
        <div className="flex items-center gap-3">
          <AvatarInitials name={c.name} seed={c.id} size={34} />
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/dashboard/contacts/${c.id}`}
              className="font-semibold text-ink-900 hover:text-blue-700"
            >
              {c.name}
            </Link>
            {c.is_primary ? (
              <Badge variant="secondary" className="mt-1 w-fit text-[11px]">
                Primary
              </Badge>
            ) : null}
          </div>
        </div>
      ),
      company: (
        <span className="text-ink-500">{c.company?.name ?? "—"}</span>
      ),
      email: <span className="text-ink-500">{c.email ?? "—"}</span>,
      phone: <span className="font-numeric text-ink-500">{c.phone ?? "—"}</span>,
      whatsapp: (
        <span className="font-numeric text-ink-500">{c.whatsapp ?? "—"}</span>
      ),
    },
  }));

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts" },
        ]}
        title="Contacts"
        description="People you work with — at companies or standalone."
        action={
          mayCreate ? (
            <Button render={<Link href="/dashboard/contacts/new" />}>
              New contact
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load contacts: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <ResponsiveList
        columns={[
          { key: "name", label: "Name", primary: true, widthHint: "28%" },
          { key: "company", label: "Company" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "whatsapp", label: "WhatsApp" },
        ]}
        rows={rows}
        empty={
          <div className="flex flex-col items-center gap-3">
            <p className="text-ink-700">No contacts yet.</p>
            {mayCreate ? (
              <Button render={<Link href="/dashboard/contacts/new" />}>
                Add your first contact
              </Button>
            ) : null}
          </div>
        }
      />
    </Page>
  );
}
