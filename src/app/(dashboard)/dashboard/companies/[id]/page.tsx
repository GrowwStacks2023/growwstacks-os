import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { Page, PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select(
      "id, name, type, timezone, business_hours_start, business_hours_end, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load company: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!company) {
    notFound();
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, role, is_primary")
    .eq("company_id", id)
    .order("created_at", { ascending: true });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Companies", href: "/dashboard/companies" },
          { label: company.name },
        ]}
        title={company.name}
        description={`Timezone: ${company.timezone} · Hours: ${company.business_hours_start}–${company.business_hours_end} · Created ${dateFormatter.format(new Date(company.created_at))}`}
        meta={
          <Badge variant="outline" className="capitalize">
            {company.type}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
          <CardDescription>People at this company.</CardDescription>
        </CardHeader>
        <CardContent>
          {!contacts || contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="divide-y">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/contacts/${contact.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {contact.name}
                      </Link>
                      {contact.is_primary ? (
                        <Badge variant="secondary">Primary</Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {contact.role ?? "—"}
                      {contact.email ? ` · ${contact.email}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AttachmentsCard
        entityType="company"
        entityId={company.id}
        revalidatePath={`/dashboard/companies/${company.id}`}
      />
    </Page>
  );
}
