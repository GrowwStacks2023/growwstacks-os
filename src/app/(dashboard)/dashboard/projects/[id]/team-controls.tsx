"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";

import { AvatarInitials } from "@/components/ui/avatar-initials";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  addProjectTeamMember,
  removeProjectTeamMember,
} from "./team-actions";

export type TeamCandidate = {
  id: string;
  name: string | null;
  email: string;
};

// Per-member remove button. Used inline next to each member chip.
export function RemoveTeamMemberButton({
  projectId,
  userId,
  userLabel,
}: {
  projectId: string;
  userId: string;
  userLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Remove ${userLabel} from the team`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove ${userLabel} from the team?`)) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await removeProjectTeamMember(projectId, userId);
            if (!result.ok) setError(result.error);
          });
        }}
        className="inline-flex size-5 items-center justify-center rounded-full text-ink-400 hover:bg-red-100/50 hover:text-red-600 disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
      {error ? (
        <span className="text-[12px] text-red-600">{error}</span>
      ) : null}
    </span>
  );
}

// Picker for adding a new team member. Lists currently-unassigned
// developers; emits an addProjectTeamMember call on Add click.
export function AddTeamMemberPicker({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: TeamCandidate[];
}) {
  const [selected, setSelected] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <p className="text-[13px] text-ink-500">
        No developers available to add. Invite one from Users first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={selected}
          onValueChange={(v) => setSelected(v ?? "")}
          disabled={pending}
        >
          <SelectTrigger className="w-full max-w-[320px]">
            <SelectValue placeholder="Select a developer to add" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name?.trim() || c.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={pending || !selected}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await addProjectTeamMember(projectId, selected);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setSelected("");
            });
          }}
        >
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

// Visual chip for a member (used on the project detail page). Pure
// presentation — controls live outside.
export function TeamMemberChip({
  user,
}: {
  user: { id: string; name: string | null; email: string };
}) {
  const label = user.name?.trim() || user.email;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-2 py-1 text-[13px]">
      <AvatarInitials name={label} seed={user.id} size={20} />
      <span className="text-ink-900">{label}</span>
    </span>
  );
}
