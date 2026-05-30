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
import { PROJECT_STATUS_OPTIONS } from "@/lib/status-colors";

import { updateProject } from "../../mutations";

type UserOption = { id: string; name: string | null; email: string };
type ContactOption = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  companyId: string | null;
  contactId: string | null;
  pmId: string | null;
  startedAt: string;
  expectedEndAt: string;
  // Read-only on edit — preserved historically (project came from a won deal).
  dealId: string | null;
};

const UNASSIGNED = "__unassigned__";
const NO_CONTACT = "";

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function dateToIsoOrNull(v: string): string | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

export function EditProjectForm({
  project,
  contacts,
  pmCandidates,
}: {
  project: Project;
  contacts: ContactOption[];
  pmCandidates: UserOption[];
}) {
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [contactId, setContactId] = useState<string>(
    project.contactId ?? NO_CONTACT
  );
  const [pmId, setPmId] = useState<string>(project.pmId ?? UNASSIGNED);
  const [startedAt, setStartedAt] = useState(project.startedAt);
  const [expectedEndAt, setExpectedEndAt] = useState(project.expectedEndAt);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // company is derived from chosen contact — same pattern as the create
  // form. If a contact is picked but has no company, project becomes
  // "internal" (company_id null is allowed after Task 26 Phase B).
  const chosenContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );
  const derivedCompanyId = chosenContact?.companyId ?? null;
  const derivedCompanyName = chosenContact?.companyName ?? null;

  const detailHref = `/dashboard/projects/${project.id}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    setPending(true);
    const result = await updateProject({
      id: project.id,
      name,
      description: nullIfBlank(description),
      status,
      companyId: derivedCompanyId,
      contactId: contactId === NO_CONTACT ? null : contactId,
      pmId: pmId === UNASSIGNED ? null : pmId,
      startedAt: dateToIsoOrNull(startedAt),
      expectedEndAt: dateToIsoOrNull(expectedEndAt),
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
        <Field id="contact_id" label="Contact">
          <Select
            value={contactId}
            onValueChange={(v) => setContactId(v ?? NO_CONTACT)}
            disabled={pending || contacts.length === 0}
          >
            <SelectTrigger id="contact_id" className="w-full">
              <SelectValue placeholder="No contact" />
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
          description="Auto-filled from the contact above. Leave the contact blank for an internal project (no company)."
        >
          <div
            id="company_derived"
            className="flex h-10 items-center rounded-[10px] border border-line bg-blue-50/40 px-3 text-[15px] text-ink-900"
          >
            {contactId
              ? derivedCompanyName ?? (
                  <span className="text-ink-400">Internal project (no company)</span>
                )
              : (
                  <span className="text-ink-400">No contact selected</span>
                )}
          </div>
        </Field>

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
          <Field id="status" label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v ?? "planning")}
              disabled={pending}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="pm_id" label="PM" optional>
            <Select
              value={pmId}
              onValueChange={(v) => setPmId(v ?? UNASSIGNED)}
              disabled={pending || pmCandidates.length === 0}
            >
              <SelectTrigger id="pm_id" className="w-full">
                <SelectValue
                  placeholder={
                    pmCandidates.length === 0
                      ? "No PMs available"
                      : "Unassigned"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
                {pmCandidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {userDisplay(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormRow>

        <FormRow>
          <Field id="started_at" label="Start date" optional>
            <Input
              id="started_at"
              type="date"
              disabled={pending}
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </Field>
          <Field id="expected_end_at" label="Target end" optional>
            <Input
              id="expected_end_at"
              type="date"
              disabled={pending}
              value={expectedEndAt}
              onChange={(e) => setExpectedEndAt(e.target.value)}
            />
          </Field>
        </FormRow>

        {project.dealId ? (
          <Field
            id="deal_id"
            label="Originating deal"
            description="This project was created from a won deal. The link is historical and cannot be changed from here."
          >
            <div
              id="deal_id"
              className="flex h-10 items-center rounded-[10px] border border-line bg-blue-50/40 px-3 text-[15px] text-ink-500"
            >
              Deal {project.dealId.slice(0, 8)}…
            </div>
          </Field>
        ) : null}
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
