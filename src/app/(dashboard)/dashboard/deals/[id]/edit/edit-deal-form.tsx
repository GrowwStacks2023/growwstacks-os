"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Field, FormActions, FormRow, FormSection } from "@/components/form";
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
import { userDisplay } from "@/lib/display";
import { DEAL_SOURCE_OPTIONS, DEAL_STAGE_OPTIONS } from "@/lib/status-colors";

import { updateDeal } from "../../mutations";

type ContactOption = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
};
type UserOption = { id: string; name: string | null; email: string };

type Deal = {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  source: string;
  ownerId: string | null;
  contactId: string | null;
  companyId: string;
  valueInr: number | null;
  valueUsd: number | null;
};

const UNASSIGNED = "__unassigned__";
const NO_CONTACT = "";

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function numberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function EditDealForm({
  deal,
  contacts,
  owners,
}: {
  deal: Deal;
  contacts: ContactOption[];
  owners: UserOption[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(deal.title);
  const [description, setDescription] = useState(deal.description ?? "");
  const [stage, setStage] = useState(deal.stage);
  const [source, setSource] = useState(deal.source);
  const [valueInr, setValueInr] = useState(
    deal.valueInr != null ? String(deal.valueInr) : ""
  );
  const [valueUsd, setValueUsd] = useState(
    deal.valueUsd != null ? String(deal.valueUsd) : ""
  );
  const [ownerId, setOwnerId] = useState<string>(deal.ownerId ?? UNASSIGNED);
  const [contactId, setContactId] = useState<string>(
    deal.contactId ?? NO_CONTACT
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // company is derived from the chosen contact, mirroring the create
  // form. If the current contact has a company, that's the deal company.
  // For the deal-already-saved case where the historical company_id may
  // not match the current contact's company, fall back to the saved
  // deal.companyId so we never write a NULL companyId from this form.
  const chosenContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );
  const derivedCompanyId = chosenContact?.companyId ?? deal.companyId;
  const derivedCompanyName =
    chosenContact?.companyName ??
    contacts.find((c) => c.id === deal.contactId)?.companyName ??
    null;

  const detailHref = `/dashboard/deals/${deal.id}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Deal title is required.");
      return;
    }
    if (!contactId) {
      setError("Please pick a contact for this deal.");
      return;
    }
    if (!derivedCompanyId) {
      setError(
        "This contact has no company. Add a company to the contact before saving the deal."
      );
      return;
    }

    setPending(true);
    const result = await updateDeal({
      id: deal.id,
      title,
      description: nullIfBlank(description),
      stage,
      source,
      ownerId: ownerId === UNASSIGNED ? null : ownerId,
      contactId,
      companyId: derivedCompanyId,
      valueInr: numberOrNull(valueInr),
      valueUsd: numberOrNull(valueUsd),
    });

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.push(detailHref);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        <Field id="contact_id" label="Contact" required>
          <Select
            value={contactId}
            onValueChange={(v) => setContactId(v ?? NO_CONTACT)}
            disabled={pending || contacts.length === 0}
          >
            <SelectTrigger id="contact_id" className="w-full">
              <SelectValue placeholder="Select a contact" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.companyName ? `${c.name} (${c.companyName})` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="company_derived"
          label="Company"
          description="Auto-filled from the contact above."
        >
          <div
            id="company_derived"
            className="flex h-10 items-center rounded-[10px] border border-line bg-blue-50/40 px-3 text-[15px] text-ink-900"
          >
            {derivedCompanyName ?? (
              <span className="text-ink-400">(no company)</span>
            )}
          </div>
        </Field>

        <Field id="title" label="Title" required>
          <Input
            id="title"
            type="text"
            autoComplete="off"
            required
            disabled={pending}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field id="description" label="Description" optional>
          <Textarea
            id="description"
            rows={3}
            disabled={pending}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <FormRow>
          <Field id="stage" label="Stage">
            <Select
              value={stage}
              onValueChange={(v) => setStage(v ?? "new")}
              disabled={pending}
            >
              <SelectTrigger id="stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="source" label="Source">
            <Select
              value={source}
              onValueChange={(v) => setSource(v ?? "other")}
              disabled={pending}
            >
              <SelectTrigger id="source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormRow>

        <FormRow>
          <Field id="value_inr" label="Value (INR)" optional>
            <Input
              id="value_inr"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              disabled={pending}
              value={valueInr}
              onChange={(e) => setValueInr(e.target.value)}
            />
          </Field>
          <Field id="value_usd" label="Value (USD)" optional>
            <Input
              id="value_usd"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              disabled={pending}
              value={valueUsd}
              onChange={(e) => setValueUsd(e.target.value)}
            />
          </Field>
        </FormRow>

        <Field id="owner_id" label="Owner" optional>
          <Select
            value={ownerId}
            onValueChange={(v) => setOwnerId(v ?? UNASSIGNED)}
            disabled={pending || owners.length === 0}
          >
            <SelectTrigger id="owner_id" className="w-full">
              <SelectValue
                placeholder={
                  owners.length === 0 ? "No owners available" : "Unassigned"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
              {owners.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {userDisplay(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

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
