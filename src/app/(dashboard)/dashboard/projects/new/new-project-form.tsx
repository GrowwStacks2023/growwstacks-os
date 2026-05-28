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
import { PROJECT_STATUS_OPTIONS } from "@/lib/status-colors";

import { createProjectDirect } from "./actions";

type CompanyOption = { id: string; name: string };
type UserOption = { id: string; name: string | null; email: string };

const UNASSIGNED = "__unassigned__";

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
}: {
  companies: CompanyOption[];
  pmCandidates: UserOption[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="company_id">Company</Label>
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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          disabled={pending}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "planning")} disabled={pending}>
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
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pm_id">PM</Label>
          <Select
            value={pmId}
            onValueChange={(v) => setPmId(v ?? UNASSIGNED)}
            disabled={pending || pmCandidates.length === 0}
          >
            <SelectTrigger id="pm_id" className="w-full">
              <SelectValue
                placeholder={
                  pmCandidates.length === 0 ? "No PMs available" : "Unassigned"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
              {pmCandidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="started_at">Start date</Label>
          <Input
            id="started_at"
            type="date"
            disabled={pending}
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expected_end_at">Target end</Label>
          <Input
            id="expected_end_at"
            type="date"
            disabled={pending}
            value={expectedEndAt}
            onChange={(e) => setExpectedEndAt(e.target.value)}
          />
        </div>
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
          render={<Link href="/dashboard/projects" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
