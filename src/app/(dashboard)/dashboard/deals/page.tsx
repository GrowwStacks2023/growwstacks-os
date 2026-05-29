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
  CardTitle,
} from "@/components/ui/card";
import { userDisplay } from "@/lib/display";
import {
  DEAL_SOURCE,
  DEAL_STAGE,
  DEAL_STAGE_ORDER,
} from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type DealSource = Database["public"]["Enums"]["deal_source"];

type DealRow = {
  id: string;
  title: string;
  stage: DealStage;
  source: DealSource;
  value_inr: number | null;
  value_usd: number | null;
  company: { name: string } | null;
  owner: { name: string | null; email: string } | null;
};

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

function dealValue(deal: Pick<DealRow, "value_inr" | "value_usd">): {
  display: string;
  inr: number;
  usd: number;
} {
  const inr = deal.value_inr ? Number(deal.value_inr) : 0;
  const usd = deal.value_usd ? Number(deal.value_usd) : 0;
  if (inr > 0) return { display: inrFormatter.format(inr), inr, usd: 0 };
  if (usd > 0) return { display: usdFormatter.format(usd), inr: 0, usd };
  return { display: "—", inr: 0, usd: 0 };
}

function stageTotalLabel(inrTotal: number, usdTotal: number): string {
  const parts: string[] = [];
  if (inrTotal > 0) parts.push(inrFormatter.format(inrTotal));
  if (usdTotal > 0) parts.push(usdFormatter.format(usdTotal));
  return parts.length === 0 ? "—" : parts.join(" + ");
}

export default async function DealsPage() {
  const supabase = await createClient();
  const { data: deals, error } = await supabase
    .from("deals")
    .select(
      "id, title, stage, source, value_inr, value_usd, company:companies(name), owner:users(name, email)"
    )
    .order("created_at", { ascending: false });

  const rows: DealRow[] = (deals ?? []) as DealRow[];

  // Bucket by stage in the canonical pipeline order. Empty columns are
  // still shown ("no proposals out right now" is meaningful signal).
  const byStage = new Map<DealStage, DealRow[]>();
  for (const stage of DEAL_STAGE_ORDER) byStage.set(stage, []);
  for (const deal of rows) byStage.get(deal.stage)?.push(deal);

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deals" },
        ]}
        title="Deals"
        description="Sales pipeline. Drag-free Kanban — click a card to open its detail."
        action={
          <Button render={<Link href="/dashboard/deals/new" />}>New deal</Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load deals: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No deals yet</CardTitle>
            <CardDescription>
              The pipeline is empty. Add your first opportunity to start
              filling the columns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/dashboard/deals/new" />}>
              Create deal
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Kanban scroll container. The page itself contains the column
        // scroll; the sidebar stays in place. min-width per column keeps
        // cards readable on tablet widths.
        <div
          className="-mx-8 overflow-x-auto px-8 pb-4"
          aria-label="Deals pipeline"
        >
          <div className="flex gap-4 min-w-max">
            {DEAL_STAGE_ORDER.map((stage) => {
              const stageDeals = byStage.get(stage) ?? [];
              const stageVisual = DEAL_STAGE[stage];
              let inrTotal = 0;
              let usdTotal = 0;
              for (const d of stageDeals) {
                const v = dealValue(d);
                inrTotal += v.inr;
                usdTotal += v.usd;
              }
              return (
                <section
                  key={stage}
                  className="flex w-[300px] shrink-0 flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3"
                  aria-label={`${stageVisual.label} column`}
                >
                  <header className="flex items-start justify-between gap-2 px-1 pt-1">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={stageVisual.variant}
                          className={stageVisual.className}
                        >
                          {stageVisual.label}
                        </Badge>
                        <span className="rounded-full bg-card px-2 py-0.5 text-[12px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                          {stageDeals.length}
                        </span>
                      </div>
                      <p className="text-[12px] font-medium text-muted-foreground">
                        {stageTotalLabel(inrTotal, usdTotal)}
                      </p>
                    </div>
                  </header>

                  {stageDeals.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-card/40 text-[13px] text-muted-foreground">
                      No deals here
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {stageDeals.map((deal) => {
                        const value = dealValue(deal);
                        const sourceVisual = DEAL_SOURCE[deal.source];
                        const ownerDisplay = userDisplay(
                          deal.owner,
                          "Unassigned"
                        );
                        return (
                          <li key={deal.id}>
                            <Link
                              href={`/dashboard/deals/${deal.id}`}
                              className="group flex flex-col gap-2.5 rounded-md border border-border bg-card p-3 transition-all hover:border-brand-300 hover:shadow-[0_4px_12px_-6px_color-mix(in_oklch,var(--brand-900)_25%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-display text-[15px] font-semibold leading-tight tracking-[-0.005em] text-foreground group-hover:text-brand-700">
                                  {deal.title}
                                </h3>
                                <Badge
                                  variant={sourceVisual.variant}
                                  className={`${sourceVisual.className} shrink-0`}
                                >
                                  {sourceVisual.label}
                                </Badge>
                              </div>
                              <p className="text-[13px] text-muted-foreground line-clamp-1">
                                {deal.company?.name ?? "—"}
                              </p>
                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/60">
                                <span className="font-numeric text-[14px] font-semibold text-foreground">
                                  {value.display}
                                </span>
                                <span
                                  className="truncate text-[12px] text-muted-foreground"
                                  title={ownerDisplay}
                                >
                                  {ownerDisplay}
                                </span>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </Page>
  );
}
