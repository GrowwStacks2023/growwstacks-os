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

import { updateCompany } from "../../mutations";

type Company = {
  id: string;
  name: string;
  type: string;
  timezone: string;
  businessHoursStart: string;
  businessHoursEnd: string;
};

export function EditCompanyForm({ company }: { company: Company }) {
  const router = useRouter();

  const [name, setName] = useState(company.name);
  const [type, setType] = useState(company.type);
  const [timezone, setTimezone] = useState(company.timezone);
  const [start, setStart] = useState(company.businessHoursStart);
  const [end, setEnd] = useState(company.businessHoursEnd);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const detailHref = `/dashboard/companies/${company.id}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    setPending(true);
    const result = await updateCompany({
      id: company.id,
      name,
      type,
      timezone,
      businessHoursStart: start,
      businessHoursEnd: end,
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

      <Field id="type" label="Type">
        <Select value={type} onValueChange={(v) => setType(v ?? "prospect")} disabled={pending}>
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field id="timezone" label="Timezone">
        <Input
          id="timezone"
          type="text"
          disabled={pending}
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
      </Field>

      <FormRow>
        <Field id="business_hours_start" label="Hours start">
          <Input
            id="business_hours_start"
            type="time"
            disabled={pending}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field id="business_hours_end" label="Hours end">
          <Input
            id="business_hours_end"
            type="time"
            disabled={pending}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </FormRow>

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
