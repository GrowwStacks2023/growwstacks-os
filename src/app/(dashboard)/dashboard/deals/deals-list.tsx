import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { userDisplay } from "@/lib/display";
import {
  DEAL_SOURCE,
  DEAL_STAGE,
} from "@/lib/status-colors";

import type { DealCard } from "./deals-board";

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

function dealValueDisplay(d: Pick<DealCard, "value_inr" | "value_usd">) {
  const inr = d.value_inr ? Number(d.value_inr) : 0;
  const usd = d.value_usd ? Number(d.value_usd) : 0;
  if (inr > 0) return inrFormatter.format(inr);
  if (usd > 0) return usdFormatter.format(usd);
  return "—";
}

// Plain list of all deals — same data the Board view shows, but flat
// and sortable by stage in the canonical pipeline order.
export function DealsList({ deals }: { deals: DealCard[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Deal</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="pr-6">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => {
              const stage = DEAL_STAGE[deal.stage];
              const source = DEAL_SOURCE[deal.source];
              const owner = userDisplay(deal.owner, "Unassigned");
              return (
                <TableRow key={deal.id}>
                  <TableCell className="pl-6">
                    <Link
                      href={`/dashboard/deals/${deal.id}`}
                      className="block hover:underline"
                    >
                      <div className="font-semibold leading-tight text-ink-900">
                        {deal.title}
                      </div>
                      <div className="text-[12px] text-ink-400">
                        {deal.company?.name ?? "—"}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={stage.variant}
                      className={stage.className}
                    >
                      {stage.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={source.variant}
                      className={source.className}
                    >
                      {source.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-ink-500">{owner}</TableCell>
                  <TableCell className="pr-6 font-numeric font-semibold text-ink-900">
                    {dealValueDisplay(deal)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
