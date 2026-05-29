import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { ResponsiveList, type ResponsiveRow } from "@/components/responsive-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ContactsPage() {
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
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/contacts/${c.id}`}
            className="text-foreground hover:text-brand-700"
          >
            {c.name}
          </Link>
          {c.is_primary ? (
            <Badge variant="secondary" className="text-[11px]">
              Primary
            </Badge>
          ) : null}
        </div>
      ),
      company: (
        <span className="text-muted-foreground">
          {c.company?.name ?? "—"}
        </span>
      ),
      email: <span className="text-muted-foreground">{c.email ?? "—"}</span>,
      phone: <span className="text-muted-foreground">{c.phone ?? "—"}</span>,
      whatsapp: (
        <span className="text-muted-foreground">{c.whatsapp ?? "—"}</span>
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
          <Button render={<Link href="/dashboard/contacts/new" />}>
            New contact
          </Button>
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
            <p className="text-foreground/80">No contacts yet.</p>
            <Button render={<Link href="/dashboard/contacts/new" />}>
              Add your first contact
            </Button>
          </div>
        }
      />
    </Page>
  );
}
