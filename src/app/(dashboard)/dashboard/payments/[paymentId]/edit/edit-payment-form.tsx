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

import { updatePayment } from "../../mutations";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  status: string;
  receivedAt: string;
  reference: string | null;
  note: string | null;
};

function numberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function EditPaymentForm({ payment }: { payment: Payment }) {
  const router = useRouter();
  const detailHref = "/dashboard/payments";

  const [amount, setAmount] = useState(String(payment.amount));
  const [currency, setCurrency] = useState(payment.currency);
  const [kind, setKind] = useState(payment.kind);
  const [status, setStatus] = useState(payment.status);
  const [receivedAt, setReceivedAt] = useState(payment.receivedAt);
  const [reference, setReference] = useState(payment.reference ?? "");
  const [note, setNote] = useState(payment.note ?? "");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = numberOrNull(amount);
    if (parsed === null || parsed <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setPending(true);
    const result = await updatePayment({
      id: payment.id,
      amount: parsed,
      currency,
      kind,
      status,
      receivedAt: status === "received" ? localToIso(receivedAt) : null,
      reference: reference.trim() ? reference.trim() : null,
      note: note.trim() ? note.trim() : null,
    });

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.push(detailHref);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href={detailHref} />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FormActions>
    </form>
  );
}
