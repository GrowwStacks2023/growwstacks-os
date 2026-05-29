import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { ResponsiveList, type ResponsiveRow } from "@/components/responsive-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, type, timezone, created_at")
    .order("created_at", { ascending: false });

  const rows: ResponsiveRow[] = (companies ?? []).map((c) => ({
    id: c.id,
    href: `/dashboard/companies/${c.id}`,
    cells: {
      name: (
        <Link
          href={`/dashboard/companies/${c.id}`}
          className="font-semibold text-ink-900 hover:text-blue-700"
        >
          {c.name}
        </Link>
      ),
      type: <span className="capitalize text-muted-foreground">{c.type}</span>,
      timezone: <span className="text-muted-foreground">{c.timezone}</span>,
      created_at: (
        <span className="text-muted-foreground">
          {dateFormatter.format(new Date(c.created_at))}
        </span>
      ),
    },
  }));

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Companies" },
        ]}
        title="Companies"
        description="Clients, prospects, and partners."
        action={
          <Button render={<Link href="/dashboard/companies/new" />}>
            New company
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load companies: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <ResponsiveList
        columns={[
          { key: "name", label: "Name", primary: true, widthHint: "35%" },
          { key: "type", label: "Type" },
          { key: "timezone", label: "Timezone" },
          { key: "created_at", label: "Created" },
        ]}
        rows={rows}
        empty={
          <div className="flex flex-col items-center gap-3">
            <p className="text-foreground/80">No companies yet.</p>
            <Button render={<Link href="/dashboard/companies/new" />}>
              Create your first
            </Button>
          </div>
        }
      />
    </Page>
  );
}
