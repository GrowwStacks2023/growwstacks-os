"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEAL_SOURCE_OPTIONS, DEAL_STAGE_OPTIONS } from "@/lib/status-colors";

import { createDeal, type CreateDealState } from "./actions";

const initialState: CreateDealState = { error: null };

type CompanyOption = { id: string; name: string };
type ContactOption = {
  id: string;
  name: string;
  companyName: string | null;
};
type UserOption = { id: string; name: string | null; email: string };

export function NewDealForm({
  companies,
  contacts,
  owners,
}: {
  companies: CompanyOption[];
  contacts: ContactOption[];
  owners: UserOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createDeal,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="company_id">Company</Label>
        <Select name="company_id" required disabled={pending}>
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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="stage">Stage</Label>
          <Select name="stage" defaultValue="new" disabled={pending}>
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
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="source">Source</Label>
          <Select name="source" defaultValue="other" disabled={pending}>
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="value_inr">Value (INR)</Label>
          <Input
            id="value_inr"
            name="value_inr"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="value_usd">Value (USD)</Label>
          <Input
            id="value_usd"
            name="value_usd"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="owner_id">Owner</Label>
        <Select name="owner_id" disabled={pending || owners.length === 0}>
          <SelectTrigger id="owner_id" className="w-full">
            <SelectValue
              placeholder={
                owners.length === 0 ? "No owners available" : "Unassigned"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {owners.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name ?? u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact_id">Contact</Label>
        <Select name="contact_id" disabled={pending || contacts.length === 0}>
          <SelectTrigger id="contact_id" className="w-full">
            <SelectValue
              placeholder={
                contacts.length === 0 ? "No contacts available" : "Optional"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.companyName ? `${c.name} (${c.companyName})` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-2 flex items-center justify-end gap-2">
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
      </div>
    </form>
  );
}
