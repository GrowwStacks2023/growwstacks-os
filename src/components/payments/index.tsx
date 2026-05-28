import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { userDisplay } from "@/lib/display";
import {
  PAYMENT_KIND,
  PAYMENT_STATUS,
  type PaymentKind,
  type PaymentStatus,
} from "@/lib/status-colors";

import { fetchDealPayments, fetchProjectPayments } from "./fetch";
import type { PaymentRow } from "./fetch";
import { RecordPaymentForm } from "./record-payment-form";

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

// Role gate shared by both cards. Returns true when the caller can see
// payments at all; developers get a clean null render upstream.
function canSeePayments(role: string | null): boolean {
  return (
    role === "admin" || role === "sales" || role === "pm"
  );
}

// Internal totals helper — split by currency, received vs expected — feeds
// the card-header summary line.
function summarize(
  payments: PaymentRow[],
  expectedInr: number | null | undefined,
  expectedUsd: number | null | undefined
): string {
  let receivedInr = 0;
  let receivedUsd = 0;
  let expectedSumInr = 0;
  let expectedSumUsd = 0;
  for (const p of payments) {
    const amt = Number(p.amount);
    if (p.status === "received") {
      if (p.currency === "INR") receivedInr += amt;
      else if (p.currency === "USD") receivedUsd += amt;
    } else if (p.status === "expected") {
      if (p.currency === "INR") expectedSumInr += amt;
      else if (p.currency === "USD") expectedSumUsd += amt;
    }
  }

  const parts: string[] = [];
  if (receivedInr > 0 || (expectedInr ?? 0) > 0) {
    const target = expectedInr ?? 0;
    parts.push(
      target > 0
        ? `${inrFormatter.format(receivedInr)} received of ${inrFormatter.format(target)}`
        : `${inrFormatter.format(receivedInr)} received`
    );
  }
  if (receivedUsd > 0 || (expectedUsd ?? 0) > 0) {
    const target = expectedUsd ?? 0;
    parts.push(
      target > 0
        ? `${usdFormatter.format(receivedUsd)} received of ${usdFormatter.format(target)}`
        : `${usdFormatter.format(receivedUsd)} received`
    );
  }
  if (expectedSumInr > 0)
    parts.push(`${inrFormatter.format(expectedSumInr)} expected (INR)`);
  if (expectedSumUsd > 0)
    parts.push(`${usdFormatter.format(expectedSumUsd)} expected (USD)`);

  return parts.length > 0 ? parts.join(" · ") : "Nothing recorded yet.";
}

// Visual row list shared by project- and deal-level cards.
function PaymentsList({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payments yet. Use the form above to log one.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {payments.map((p) => {
        const kind = PAYMENT_KIND[p.kind as PaymentKind];
        const status = PAYMENT_STATUS[p.status as PaymentStatus];
        const recorder = userDisplay(p.recorder, "Unknown");
        return (
          <li
            key={p.id}
            className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {fmtMoney(Number(p.amount), p.currency)}
                </span>
                <Badge variant={kind.variant} className={kind.className}>
                  {kind.label}
                </Badge>
                <Badge variant={status.variant} className={status.className}>
                  {status.label}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {p.received_at
                  ? `Received ${dateFormatter.format(new Date(p.received_at))}`
                  : `Logged ${dateFormatter.format(new Date(p.created_at))}`}
                {" · "}
                {recorder}
                {p.reference ? ` · Ref: ${p.reference}` : ""}
              </span>
              {p.note ? (
                <p className="text-xs text-muted-foreground">{p.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type ProjectProps = {
  projectId: string;
  companyId: string;
  // Money figure(s) the calling page knows about — drives the summary line.
  expectedInr?: number | null;
  expectedUsd?: number | null;
  revalidatePath: string;
};

// Server Component for project detail. Role-gates the whole section so
// developers don't see an empty card with no useful CTA (RLS would block
// their reads anyway).
export async function PaymentsCard({
  projectId,
  companyId,
  expectedInr,
  expectedUsd,
  revalidatePath,
}: ProjectProps) {
  const { payments, currentUserRole } = await fetchProjectPayments(projectId);
  if (!canSeePayments(currentUserRole)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payments</CardTitle>
        <CardDescription>
          {summarize(payments, expectedInr, expectedUsd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RecordPaymentForm
          mode="fixed"
          projectId={projectId}
          dealId={null}
          companyId={companyId}
          revalidatePath={revalidatePath}
        />
        <PaymentsList payments={payments} />
      </CardContent>
    </Card>
  );
}

type DealProps = {
  dealId: string;
  companyId: string;
  expectedInr?: number | null;
  expectedUsd?: number | null;
  revalidatePath: string;
};

// Deal-level companion. Useful for advance / mobilisation payments against
// a deal that hasn't converted into a project yet. Same role gate, same
// shape as PaymentsCard but filters by deal_id and posts with dealId set.
export async function DealPaymentsCard({
  dealId,
  companyId,
  expectedInr,
  expectedUsd,
  revalidatePath,
}: DealProps) {
  const { payments, currentUserRole } = await fetchDealPayments(dealId);
  if (!canSeePayments(currentUserRole)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payments</CardTitle>
        <CardDescription>
          {summarize(payments, expectedInr, expectedUsd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RecordPaymentForm
          mode="fixed"
          projectId={null}
          dealId={dealId}
          companyId={companyId}
          revalidatePath={revalidatePath}
        />
        <PaymentsList payments={payments} />
      </CardContent>
    </Card>
  );
}
