"use client";

import Link from "next/link";
import { useActionState } from "react";

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

import { createCompany, type CreateCompanyState } from "./actions";

const initialState: CreateCompanyState = { error: null };

export function NewCompanyForm() {
  const [state, formAction, pending] = useActionState(
    createCompany,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="name" label="Name" required>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
        />
      </Field>

      <Field id="type" label="Type">
        <Select name="type" defaultValue="prospect" disabled={pending}>
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
          name="timezone"
          type="text"
          defaultValue="Asia/Kolkata"
          disabled={pending}
        />
      </Field>

      <FormRow>
        <Field id="business_hours_start" label="Hours start">
          <Input
            id="business_hours_start"
            name="business_hours_start"
            type="time"
            defaultValue="09:00"
            disabled={pending}
          />
        </Field>
        <Field id="business_hours_end" label="Hours end">
          <Input
            id="business_hours_end"
            name="business_hours_end"
            type="time"
            defaultValue="19:00"
            disabled={pending}
          />
        </Field>
      </FormRow>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href="/dashboard/companies" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create company"}
        </Button>
      </FormActions>
    </form>
  );
}
