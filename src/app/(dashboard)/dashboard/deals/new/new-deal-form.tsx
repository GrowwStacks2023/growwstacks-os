"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  commitStagedAttachments,
  StagedAttachments,
  type StagedItem,
} from "@/components/attachments/staged";
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

import { createDealDirect } from "./actions";

type CompanyOption = { id: string; name: string };
type ContactOption = {
  id: string;
  name: string;
  companyName: string | null;
};
type UserOption = { id: string; name: string | null; email: string };

const UNASSIGNED = "__unassigned__";
const NO_CONTACT = "__none__";

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

export function NewDealForm({
  companies,
  contacts,
  owners,
}: {
  companies: CompanyOption[];
  contacts: ContactOption[];
  owners: UserOption[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState("new");
  const [source, setSource] = useState("other");
  const [valueInr, setValueInr] = useState("");
  const [valueUsd, setValueUsd] = useState("");
  const [ownerId, setOwnerId] = useState<string>(UNASSIGNED);
  const [contactId, setContactId] = useState<string>(NO_CONTACT);

  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [partial, setPartial] = useState<{
    dealId: string;
    failures: { name: string; reason: string }[];
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Deal title is required.");
      return;
    }
    if (!companyId) {
      setError("Please pick a company for this deal.");
      return;
    }

    setPending(true);

    const result = await createDealDirect({
      title,
      companyId,
      description: nullIfBlank(description),
      stage,
      source,
      ownerId: ownerId === UNASSIGNED ? null : ownerId,
      contactId: contactId === NO_CONTACT ? null : contactId,
      valueInr: numberOrNull(valueInr),
      valueUsd: numberOrNull(valueUsd),
    });

    if (result.error || !result.dealId) {
      setPending(false);
      setError(result.error ?? "Couldn't create the deal.");
      return;
    }

    const dealId = result.dealId;

    if (staged.length === 0) {
      router.push(`/dashboard/deals/${dealId}`);
      return;
    }

    const commit = await commitStagedAttachments("deal", dealId, staged);

    if (commit.failed.length === 0) {
      router.push(`/dashboard/deals/${dealId}`);
      return;
    }

    setPending(false);
    setPartial({
      dealId,
      failures: commit.failed.map((f) => ({
        name:
          f.item.kind === "file"
            ? f.item.label || f.item.file.name
            : f.item.label || f.item.url,
        reason: f.reason,
      })),
    });
  }

  if (partial) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Deal created, but {partial.failures.length} attachment
            {partial.failures.length === 1 ? "" : "s"} failed:
            <ul className="mt-2 list-disc pl-5 text-sm">
              {partial.failures.map((f, i) => (
                <li key={i}>
                  <span className="font-medium">{f.name}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button
            render={<Link href={`/dashboard/deals/${partial.dealId}`} />}
          >
            Continue to deal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        <Field id="company_id" label="Company" required>
          <Select
            value={companyId}
            onValueChange={(v) => setCompanyId(v ?? "")}
            disabled={pending}
          >
            <SelectTrigger id="company_id" className="w-full">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <FormRow>
          <Field id="owner_id" label="Owner" optional>
            <Select
              value={ownerId}
              onValueChange={(v) => setOwnerId(v ?? UNASSIGNED)}
              disabled={pending || owners.length === 0}
            >
              <SelectTrigger id="owner_id" className="w-full">
                <SelectValue
                  placeholder={
                    owners.length === 0
                      ? "No owners available"
                      : "Unassigned"
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
          <Field id="contact_id" label="Contact" optional>
            <Select
              value={contactId}
              onValueChange={(v) => setContactId(v ?? NO_CONTACT)}
              disabled={pending || contacts.length === 0}
            >
              <SelectTrigger id="contact_id" className="w-full">
                <SelectValue
                  placeholder={
                    contacts.length === 0
                      ? "No contacts available"
                      : "None"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTACT}>— None —</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.companyName ? `${c.name} (${c.companyName})` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormRow>
      </FormSection>

      <StagedAttachments
        items={staged}
        onChange={setStaged}
        disabled={pending}
      />

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
          render={<Link href="/dashboard/deals" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create deal"}
        </Button>
      </FormActions>
    </form>
  );
}
