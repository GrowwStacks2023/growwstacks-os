import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DEAL_SOURCE, DEAL_STAGE } from "@/lib/status-colors";
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

function formatValue(inr: number | null, usd: number | null): string {
  const parts: string[] = [];
  if (inr && inr > 0) parts.push(inrFormatter.format(Number(inr)));
  if (usd && usd > 0) parts.push(usdFormatter.format(Number(usd)));
  return parts.length === 0 ? "—" : parts.join(" + ");
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from("deals")
    .select(
      "id, title, description, stage, source, value_inr, value_usd, created_at, won_at, lost_at, lost_reason, company:companies(id, name), contact:contacts(id, name), owner:users(name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load deal: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!deal) {
    notFound();
  }

  const stage = DEAL_STAGE[deal.stage];
  const source = DEAL_SOURCE[deal.source];
  const ownerDisplay = deal.owner?.name ?? deal.owner?.email ?? "Unassigned";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/deals"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Deals
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-medium">{deal.title}</h1>
          <Badge variant={stage.variant} className={stage.className}>
            {stage.label}
          </Badge>
          <Badge variant={source.variant} className={source.className}>
            {source.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {deal.company ? (
            <Link
              href={`/dashboard/companies/${deal.company.id}`}
              className="hover:underline"
            >
              {deal.company.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Owner: {ownerDisplay}
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Value:</dt>
            <dd className="font-medium">
              {formatValue(deal.value_inr, deal.value_usd)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Contact:</dt>
            <dd>{deal.contact?.name ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Created:</dt>
            <dd>{dateFormatter.format(new Date(deal.created_at))}</dd>
          </div>
          {deal.won_at ? (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Won:</dt>
              <dd>{dateFormatter.format(new Date(deal.won_at))}</dd>
            </div>
          ) : null}
          {deal.lost_at ? (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Lost:</dt>
              <dd>{dateFormatter.format(new Date(deal.lost_at))}</dd>
            </div>
          ) : null}
        </dl>
        {deal.lost_reason ? (
          <p className="text-sm text-muted-foreground">
            Lost reason: {deal.lost_reason}
          </p>
        ) : null}
        {deal.description ? (
          <p className="mt-2 max-w-2xl text-sm text-foreground/90">
            {deal.description}
          </p>
        ) : null}
      </div>

      <Separator />

      <AttachmentsCard
        entityType="deal"
        entityId={deal.id}
        revalidatePath={`/dashboard/deals/${deal.id}`}
      />
    </div>
  );
}
