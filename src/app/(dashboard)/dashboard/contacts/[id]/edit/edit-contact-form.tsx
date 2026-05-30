"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormActions, FormRow, FormSection } from "@/components/form";
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

import { updateContact } from "../../mutations";

type CompanyOption = { id: string; name: string };
type Contact = {
  id: string;
  name: string;
  companyId: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  role: string | null;
  isPrimary: boolean;
};

const NO_COMPANY = "__none__";

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

export function EditContactForm({
  contact,
  companies,
}: {
  contact: Contact;
  companies: CompanyOption[];
}) {
  const router = useRouter();

  const [name, setName] = useState(contact.name);
  const [companyId, setCompanyId] = useState<string>(
    contact.companyId ?? NO_COMPANY
  );
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(contact.whatsapp ?? "");
  const [role, setRole] = useState(contact.role ?? "");
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const detailHref = `/dashboard/contacts/${contact.id}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Contact name is required.");
      return;
    }

    setPending(true);
    const result = await updateContact({
      id: contact.id,
      name,
      companyId: companyId === NO_COMPANY ? null : companyId,
      email: nullIfBlank(email),
      phone: nullIfBlank(phone),
      whatsapp: nullIfBlank(whatsapp),
      role: nullIfBlank(role),
      isPrimary,
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
        <Field id="name" label="Name" required>
          <Input
            id="name"
            type="text"
            autoComplete="off"
            required
            disabled={pending}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field id="company_id" label="Company" optional>
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
        </Field>

        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="off"
            disabled={pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <FormRow>
          <Field id="phone" label="Phone">
            <Input
              id="phone"
              type="tel"
              autoComplete="off"
              disabled={pending}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id="whatsapp" label="WhatsApp">
            <Input
              id="whatsapp"
              type="tel"
              autoComplete="off"
              disabled={pending}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </Field>
        </FormRow>

        <Field id="role" label="Role">
          <Input
            id="role"
            type="text"
            placeholder="e.g. Head of Marketing"
            autoComplete="off"
            disabled={pending}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="is_primary"
            checked={isPrimary}
            onCheckedChange={(v) => setIsPrimary(v === true)}
            disabled={pending}
          />
          <Label
            htmlFor="is_primary"
            className="text-[13px] font-normal text-foreground/80"
          >
            Primary contact (when a company is set)
          </Label>
        </div>
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
