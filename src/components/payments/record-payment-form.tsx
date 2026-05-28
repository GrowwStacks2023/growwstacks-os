"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormActions, FormRow } from "@/components/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_KIND_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "@/lib/status-colors";

import { recordPayment } from "./actions";

// Each option carries the company_id it's attached to so we can derive
// payments.company_id without making the user pick separately.
export type PaymentContextOption = {
  kind: "project" | "deal";
  id: string;
  label: string;
  companyId: string;
};

// Two operating modes:
//  - "fixed": the calling detail page already knows project/deal/company.
//    Used by <PaymentsCard> (project detail) and <DealPaymentsCard>
//    (deal detail).
//  - "picker": the user is on /dashboard/payments/new and chooses which
//    project or deal to attach the payment to. company_id is derived from
//    the chosen option.
type FixedProps = {
  mode: "fixed";
  projectId: string | null;
  dealId: string | null;
  companyId: string;
  revalidatePath: string;
  onDone?: () => void;
};

type PickerProps = {
  mode: "picker";
  options: PaymentContextOption[];
  // Where to revalidate after a successful insert. The /payments page is
  // the most useful spot to refresh.
  revalidatePath: string;
  // Where to go after success. Picker mode redirects so the user lands
  // back on the list; fixed mode stays in place.
  redirectTo: string;
};

type Props = FixedProps | PickerProps;

function numberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// HTML <input type="datetime-local"> → ISO so it round-trips into timestamptz
// without surprise timezone juggling. Empty input → null.
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Render-local-time YYYY-MM-DDTHH:MM (16 chars) for the receivedAt default.
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Encode an option as "<kind>:<id>" so the Select value is a single string.
function encodeOption(o: PaymentContextOption): string {
  return `${o.kind}:${o.id}`;
}

const NO_CONTEXT = "__none__";

export function RecordPaymentForm(props: Props) {
  const router = useRouter();

  // Form-level shared state.
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [kind, setKind] = useState("installment");
  const [status, setStatus] = useState("received");
  const [receivedAt, setReceivedAt] = useState(todayLocal());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Picker-mode state. Encoded as "<kind>:<id>"; NO_CONTEXT means nothing
  // selected yet.
  const [contextChoice, setContextChoice] = useState<string>(NO_CONTEXT);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedAmount = numberOrNull(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    // Resolve project/deal/company based on mode.
    let projectId: string | null = null;
    let dealId: string | null = null;
    let companyId = "";

    if (props.mode === "fixed") {
      projectId = props.projectId;
      dealId = props.dealId;
      companyId = props.companyId;
    } else {
      if (contextChoice === NO_CONTEXT) {
        setError("Pick a project or deal to attach this payment to.");
        return;
      }
      const chosen = props.options.find(
        (o) => encodeOption(o) === contextChoice
      );
      if (!chosen) {
        setError("That project/deal is no longer available.");
        return;
      }
      if (chosen.kind === "project") projectId = chosen.id;
      else dealId = chosen.id;
      companyId = chosen.companyId;
    }

    setPending(true);
    const result = await recordPayment({
      projectId,
      dealId,
      companyId,
      amount: parsedAmount,
      currency,
      kind,
      status,
      // Only meaningful when status='received'; the server action ignores it
      // otherwise to keep "expected" rows clean.
      receivedAt: status === "received" ? localToIso(receivedAt) : null,
      reference: reference.trim() ? reference.trim() : null,
      note: note.trim() ? note.trim() : null,
      revalidate: props.revalidatePath,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (props.mode === "picker") {
      router.push(props.redirectTo);
      return;
    }

    // Fixed mode: clear inputs and let the parent re-render via revalidatePath.
    setAmount("");
    setReference("");
    setNote("");
    setKind("installment");
    setStatus("received");
    setCurrency("INR");
    setReceivedAt(todayLocal());
    props.onDone?.();
  }

  // Fixed-mode panel: render the form embedded in the detail page's
  // payments card with a subtle border + uppercase title.
  // Picker-mode page: drop the border/title because the page itself
  // already provides the heading via PageHeader.
  const isPicker = props.mode === "picker";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isPicker
          ? "flex flex-col gap-5"
          : "flex flex-col gap-5 rounded-md border bg-muted/30 p-4"
      }
    >
      {!isPicker ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Record payment
        </div>
      ) : null}

      {props.mode === "picker" ? (
        <Field
          id="context"
          label="Attach to"
          required
          description="Company is filled in automatically from the chosen project or deal."
        >
          <Select
            value={contextChoice}
            onValueChange={(v) => setContextChoice(v ?? NO_CONTEXT)}
            disabled={pending}
          >
            <SelectTrigger id="context" className="w-full">
              <SelectValue placeholder="Pick a project or deal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CONTEXT}>— Pick one —</SelectItem>
              {props.options.map((o) => (
                <SelectItem key={encodeOption(o)} value={encodeOption(o)}>
                  {o.kind === "project"
                    ? `Project · ${o.label}`
                    : `Deal · ${o.label}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <FormRow cols={3}>
        <Field id="amount" label="Amount" required>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            disabled={pending}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field id="currency" label="Currency">
          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v ?? "INR")}
            disabled={pending}
          >
            <SelectTrigger id="currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id="kind" label="Kind">
          <Select
            value={kind}
            onValueChange={(v) => setKind(v ?? "installment")}
            disabled={pending}
          >
            <SelectTrigger id="kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_KIND_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormRow>

      <FormRow>
        <Field id="status" label="Status">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v ?? "received")}
            disabled={pending}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="received_at"
          label={
            <>
              Received at{" "}
              {status === "received" ? null : (
                <span className="text-[11px] font-normal text-muted-foreground">
                  (ignored)
                </span>
              )}
            </>
          }
        >
          <Input
            id="received_at"
            type="datetime-local"
            disabled={pending || status !== "received"}
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </Field>
      </FormRow>

      <Field id="reference" label="Reference" optional>
        <Input
          id="reference"
          type="text"
          placeholder="Invoice #, UTR, bank ref…"
          disabled={pending}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </Field>

      <Field id="note" label="Note" optional>
        <Textarea
          id="note"
          rows={2}
          disabled={pending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        {isPicker ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            render={<Link href="/dashboard/payments" />}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </FormActions>
    </form>
  );
}
