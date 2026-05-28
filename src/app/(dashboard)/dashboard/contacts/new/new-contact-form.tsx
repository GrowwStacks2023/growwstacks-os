"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  commitStagedAttachments,
  StagedAttachments,
  type StagedItem,
} from "@/components/attachments/staged";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createContactDirect } from "./actions";

type CompanyOption = { id: string; name: string };

const NO_COMPANY = "__none__";

export function NewContactForm({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>(NO_COMPANY);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // After a successful create where some attachments failed, hold the user
  // on this page with a "Continue to contact" button. Anything in this state
  // means the contact exists already — don't re-submit.
  const [partial, setPartial] = useState<{
    contactId: string;
    failures: { name: string; reason: string }[];
  } | null>(null);

  function nullIfBlank(v: string): string | null {
    const t = v.trim();
    return t ? t : null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Contact name is required.");
      return;
    }

    setPending(true);

    const result = await createContactDirect({
      name,
      companyId: companyId === NO_COMPANY ? null : companyId,
      email: nullIfBlank(email),
      phone: nullIfBlank(phone),
      whatsapp: nullIfBlank(whatsapp),
      role: nullIfBlank(role),
      isPrimary,
    });

    if (result.error || !result.contactId) {
      setPending(false);
      setError(result.error ?? "Couldn't create the contact.");
      return;
    }

    const contactId = result.contactId;

    if (staged.length === 0) {
      router.push(`/dashboard/contacts/${contactId}`);
      return;
    }

    const commit = await commitStagedAttachments("contact", contactId, staged);

    if (commit.failed.length === 0) {
      router.push(`/dashboard/contacts/${contactId}`);
      return;
    }

    // Partial failure: contact exists, some attachments didn't. Surface the
    // detail so the user can decide what to retry on the detail page.
    setPending(false);
    setPartial({
      contactId,
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
            Contact created, but {partial.failures.length} attachment
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
            render={
              <Link href={`/dashboard/contacts/${partial.contactId}`} />
            }
          >
            Continue to contact
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="company_id">Company (optional)</Label>
        <Select
          value={companyId}
          onValueChange={(v) => setCompanyId(v ?? NO_COMPANY)}
          disabled={pending}
        >
          <SelectTrigger id="company_id" className="w-full">
            <SelectValue placeholder="No company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_COMPANY}>— None —</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          disabled={pending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="off"
            disabled={pending}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            type="tel"
            autoComplete="off"
            disabled={pending}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <Input
          id="role"
          type="text"
          placeholder="e.g. Head of Marketing"
          autoComplete="off"
          disabled={pending}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_primary"
          checked={isPrimary}
          onCheckedChange={(v) => setIsPrimary(v === true)}
          disabled={pending}
        />
        <Label htmlFor="is_primary" className="font-normal">
          Primary contact (when a company is set)
        </Label>
      </div>

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

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href="/dashboard/contacts" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create contact"}
        </Button>
      </div>
    </form>
  );
}
