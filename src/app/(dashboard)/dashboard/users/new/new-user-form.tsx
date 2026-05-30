"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { USER_ROLE_OPTIONS } from "@/lib/status-colors";

import { inviteUser } from "../actions";

export function NewUserForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    email: string;
    actionLink: string | null;
  } | null>(null);
  // Initial empty value forces an explicit pick. Default-"developer"
  // historically caused admins to silently invite developers because
  // the trigger would only let role changes through for an *actual*
  // change — typing email+name and submitting kept role at the default.
  const [role, setRole] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError("Pick a role for this teammate.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("role", role);
    const emailValue = String(formData.get("email") ?? "").trim();

    setPending(true);
    const result = await inviteUser(formData);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess({ email: emailValue, actionLink: result.actionLink });
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Invited <span className="font-semibold">{success.email}</span>.
            Supabase sent them an email with a link to set their password.
            {success.actionLink ? (
              <div className="mt-3 flex flex-col gap-1">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Fallback link
                </span>
                <span className="text-[12px] text-ink-500">
                  Email delivery requires SMTP to be configured in Supabase.
                  If the user doesn&apos;t receive the email, copy and forward
                  this link manually:
                </span>
                <a
                  href={success.actionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all rounded-[8px] bg-blue-50 px-2 py-1.5 font-numeric text-[12px] text-blue-700 hover:underline"
                >
                  {success.actionLink}
                </a>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setSuccess(null);
              setError(null);
              setRole("");
            }}
          >
            Invite another
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/dashboard/users")}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        <Field id="email" label="Email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            disabled={pending}
            placeholder="teammate@growwstacks.com"
          />
        </Field>

        <FormRow>
          <Field id="name" label="Name" optional>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="off"
              disabled={pending}
              placeholder="Optional — visible in mentions and badges"
            />
          </Field>
          <Field id="role" label="Role" required>
            <Select
              value={role}
              onValueChange={(v) => setRole(v ?? "")}
              disabled={pending}
            >
              <SelectTrigger
                id="role"
                className="w-full"
                aria-invalid={!role || undefined}
              >
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormRow>
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
          render={<Link href="/dashboard/users" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending invite…" : "Send invite"}
        </Button>
      </FormActions>
    </form>
  );
}
