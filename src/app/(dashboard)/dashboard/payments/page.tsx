import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PAYMENT_KIND,
  PAYMENT_STATUS,
  type PaymentKind,
  type PaymentStatus,
} from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmtMoney(amount: number, currency: string): string {
  if (currency === "USD") return usdFormatter.format(amount);
  return inrFormatter.format(amount);
}

// Role gating for this section lives in
// app/(dashboard)/dashboard/payments/layout.tsx → guardSection("payments").
// We don't repeat it inline here.

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  kind: PaymentKind;
  status: PaymentStatus;
  received_at: string | null;
  created_at: string;
  reference: string | null;
  project_id: string | null;
  deal_id: string | null;
  company_id: string;
};

export default async function PaymentsPage() {
  const supabase = await createClient();

  // ── Single payments query, then batch context lookups ──────────────
  // Same shape as the dashboard / tasks list: gather distinct ids,
  // resolve names in parallel .in() queries, build maps. No N+1.
  const { data: payments, error } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, kind, status, received_at, created_at, reference, project_id, deal_id, company_id"
    )
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (payments ?? []) as unknown as PaymentRow[];

  const projectIds = new Set<string>();
  const dealIds = new Set<string>();
  const companyIds = new Set<string>();
  for (const p of rows) {
    if (p.project_id) projectIds.add(p.project_id);
    if (p.deal_id) dealIds.add(p.deal_id);
    if (p.company_id) companyIds.add(p.company_id);
  }

  const [projectsRes, dealsRes, companiesRes] = await Promise.all([
    projectIds.size > 0
      ? supabase
          .from("projects")
          .select("id, name")
          .in("id", Array.from(projectIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    dealIds.size > 0
      ? supabase
          .from("deals")
          .select("id, title")
          .in("id", Array.from(dealIds))
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    companyIds.size > 0
      ? supabase
          .from("companies")
          .select("id, name")
          .in("id", Array.from(companyIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const projectsById = new Map(
    (projectsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const dealsById = new Map((dealsRes.data ?? []).map((d) => [d.id, d.title]));
  const companiesById = new Map(
    (companiesRes.data ?? []).map((c) => [c.id, c.name])
  );

  // Per-currency totals, never summed across currencies — different things,
  // different signals.
  let receivedInr = 0;
  let receivedUsd = 0;
  let expectedInr = 0;
  let expectedUsd = 0;
  for (const p of rows) {
    const amt = Number(p.amount);
    if (p.status === "received") {
      if (p.currency === "INR") receivedInr += amt;
      else if (p.currency === "USD") receivedUsd += amt;
    } else if (p.status === "expected") {
      if (p.currency === "INR") expectedInr += amt;
      else if (p.currency === "USD") expectedUsd += amt;
    }
  }

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments" },
        ]}
        title="Payments"
        description="Every payment across projects and deals."
        action={
          <Button render={<Link href="/dashboard/payments/new" />}>
            Record payment
          </Button>
        }
      />

      {/*
        Currency split deliberately on two lines. We never collapse INR +
        USD into a single number — they're different units.
      */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Received
            </div>
            <div className="text-sm">
              {inrFormatter.format(receivedInr)}{" "}
              <span className="text-muted-foreground">/</span>{" "}
              {usdFormatter.format(receivedUsd)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Expected
            </div>
            <div className="text-sm">
              {inrFormatter.format(expectedInr)}{" "}
              <span className="text-muted-foreground">/</span>{" "}
              {usdFormatter.format(expectedUsd)}
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load payments: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        {rows.length === 0 ? (
          <CardHeader>
            <CardDescription>
              No payments yet. Use <span className="font-medium">Record payment</span> above
              to log the first one.
            </CardDescription>
          </CardHeader>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Amount</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="pr-4">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const kind = PAYMENT_KIND[p.kind];
                  const status = PAYMENT_STATUS[p.status];
                  const contextHref = p.project_id
                    ? `/dashboard/projects/${p.project_id}`
                    : p.deal_id
                      ? `/dashboard/deals/${p.deal_id}`
                      : null;
                  const contextLabel = p.project_id
                    ? `Project: ${projectsById.get(p.project_id) ?? "—"}`
                    : p.deal_id
                      ? `Deal: ${dealsById.get(p.deal_id) ?? "—"}`
                      : "—";
                  const companyName = companiesById.get(p.company_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4 font-medium">
                        {fmtMoney(Number(p.amount), p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={kind.variant} className={kind.className}>
                          {kind.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contextHref ? (
                          <Link href={contextHref} className="hover:underline">
                            {contextLabel}
                          </Link>
                        ) : (
                          contextLabel
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {companyName ? (
                          <Link
                            href={`/dashboard/companies/${p.company_id}`}
                            className="hover:underline"
                          >
                            {companyName}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.received_at
                          ? dateFormatter.format(new Date(p.received_at))
                          : "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">
                        {p.reference ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </Page>
  );
}
