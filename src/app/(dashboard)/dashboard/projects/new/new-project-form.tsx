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
import { PROJECT_STATUS_OPTIONS } from "@/lib/status-colors";

import { createProjectDirect } from "./actions";

type CompanyOption = { id: string; name: string };
type UserOption = { id: string; name: string | null; email: string };
type ContactOption = {
  id: string;
  name: string;
  companyName: string | null;
};

const UNASSIGNED = "__unassigned__";
const NO_CONTACT = "__none__";

function nullIfBlank(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function dateToIsoOrNull(v: string): string | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`).toISOString();
}

export function NewProjectForm({
  companies,
  pmCandidates,
  contacts,
}: {
  companies: CompanyOption[];
  pmCandidates: UserOption[];
  contacts: ContactOption[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [pmId, setPmId] = useState<string>(UNASSIGNED);
  const [startedAt, setStartedAt] = useState("");
  const [expectedEndAt, setExpectedEndAt] = useState("");

  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [partial, setPartial] = useState<{
    projectId: string;
    failures: { name: string; reason: string }[];
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!companyId) {
      setError("Please pick a company for this project.");
      return;
    }

    setPending(true);

    const result = await createProjectDirect({
      name,
      companyId,
      contactId: contactId === NO_CONTACT ? null : contactId,
      description: nullIfBlank(description),
      status,
      pmId: pmId === UNASSIGNED ? null : pmId,
      startedAt: dateToIsoOrNull(startedAt),
      expectedEndAt: dateToIsoOrNull(expectedEndAt),
    });

    if (result.error || !result.projectId) {
      setPending(false);
      setError(result.error ?? "Couldn't create the project.");
      return;
    }

    const projectId = result.projectId;

    if (staged.length === 0) {
      router.push(`/dashboard/projects/${projectId}`);
      return;
    }

    const commit = await commitStagedAttachments(
      "project",
      projectId,
      staged
    );

    if (commit.failed.length === 0) {
      router.push(`/dashboard/projects/${projectId}`);
      return;
    }

    setPending(false);
    setPartial({
      projectId,
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
            Project created, but {partial.failures.length} attachment
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
              <Link href={`/dashboard/projects/${partial.projectId}`} />
            }
          >
            Continue to project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        <FormRow>
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
                      : "No contact"
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
          render={<Link href="/dashboard/projects" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </FormActions>
    </form>
  );
}
