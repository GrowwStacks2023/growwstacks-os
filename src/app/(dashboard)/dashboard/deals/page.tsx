import Link from "next/link";

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

function formatDealValue(deal: Pick<DealRow, "value_inr" | "value_usd">): {
  display: string;
  // For per-stage totals we collapse to a single currency at most; mixed-
  // currency stages just show two figures separated.
  inr: number;
  usd: number;
} {
  const inr = deal.value_inr ? Number(deal.value_inr) : 0;
  const usd = deal.value_usd ? Number(deal.value_usd) : 0;
  if (inr > 0) {
    return { display: inrFormatter.format(inr), inr, usd: 0 };
  }
  if (usd > 0) {
    return { display: usdFormatter.format(usd), inr: 0, usd };
  }
  return { display: "—", inr: 0, usd: 0 };
}

function formatStageTotal(inrTotal: number, usdTotal: number): string {
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

  // Bucket by stage in the canonical pipeline order. Stages with no deals are
  // still shown (empty column tells the reader "no proposals out right now").
  const byStage = new Map<DealStage, DealRow[]>();
  for (const stage of DEAL_STAGE_ORDER) byStage.set(stage, []);
  for (const deal of rows) byStage.get(deal.stage)?.push(deal);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Deals</h1>
          <p className="text-sm text-muted-foreground">
            Sales pipeline, grouped by stage.
          </p>
        </div>
        <Button render={<Link href="/dashboard/deals/new" />}>New deal</Button>
      </div>

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
            <CardTitle className="text-base">No deals yet</CardTitle>
            <CardDescription>
              No deals yet. Create your first one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/dashboard/deals/new" />}>
              Create deal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {DEAL_STAGE_ORDER.map((stage) => {
            const stageDeals = byStage.get(stage) ?? [];
            const stageVisual = DEAL_STAGE[stage];
            let inrTotal = 0;
            let usdTotal = 0;
            for (const d of stageDeals) {
              const v = formatDealValue(d);
              inrTotal += v.inr;
              usdTotal += v.usd;
            }
            return (
              <Card key={stage}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={stageVisual.variant}
                      className={stageVisual.className}
                    >
                      {stageVisual.label}
                    </Badge>
                    <CardDescription className="text-sm">
                      {stageDeals.length}{" "}
                      {stageDeals.length === 1 ? "deal" : "deals"}
                    </CardDescription>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatStageTotal(inrTotal, usdTotal)}
                  </div>
                </CardHeader>
                <CardContent>
                  {stageDeals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing in this stage.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {stageDeals.map((deal) => {
                        const value = formatDealValue(deal);
                        const sourceVisual = DEAL_SOURCE[deal.source];
                        const ownerDisplay =
                          deal.owner?.name ?? deal.owner?.email ?? "Unassigned";
                        return (
                          <div
                            key={deal.id}
                            className="flex flex-col gap-2 rounded-md border bg-card p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium leading-tight">
                                {deal.title}
                              </div>
                              <Badge
                                variant={sourceVisual.variant}
                                className={sourceVisual.className}
                              >
                                {sourceVisual.label}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {deal.company?.name ?? "—"}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">
                                {value.display}
                              </span>
                              <span className="text-muted-foreground">
                                {ownerDisplay}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
