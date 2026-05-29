"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormActions, FormSection } from "@/components/form";
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

import { generateApiKey } from "../actions";

export function NewKeyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<string>("read");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    fullKey: string;
    prefix: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await generateApiKey(name, scope);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCreated({ fullKey: result.fullKey, prefix: result.prefix });
  }

  async function copyKey() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.fullKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can fail under non-HTTPS dev. Fall back: the value
      // is still visible in the readonly input so the user can select it.
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Copy this key now.</strong> You won&apos;t be able to see
            it again. If lost, revoke this key and generate a new one.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-blue-50/40 p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            API key — shown once
          </span>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={created.fullKey}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 font-numeric"
              aria-label="API key (copy now)"
            />
            <Button
              type="button"
              variant="outline"
              onClick={copyKey}
              aria-label="Copy key"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-[12px] text-ink-500">
            Prefix shown in the integrations list:{" "}
            <span className="font-numeric text-ink-700">
              {created.prefix}…
            </span>
          </p>
        </div>

        <FormActions>
          <Button
            type="button"
            onClick={() => router.push("/dashboard/integrations")}
          >
            Done
          </Button>
        </FormActions>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection>
        <Field
          id="name"
          label="Name"
          required
          description="Descriptive label visible to admins. E.g. 'n8n workflow', 'Marketing Postman tests'."
        >
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

        <Field
          id="scope"
          label="Scope"
          required
          description="Read keys can GET only. Read + Write keys can also POST to create new rows. Pick the least privilege you need."
        >
          <Select
            value={scope}
            onValueChange={(v) => setScope(v ?? "read")}
            disabled={pending}
          >
            <SelectTrigger id="scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">Read only</SelectItem>
              <SelectItem value="read_write">Read + Write</SelectItem>
            </SelectContent>
          </Select>
        </Field>
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
          render={<Link href="/dashboard/integrations" />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Generating…" : "Generate key"}
        </Button>
      </FormActions>
    </form>
  );
}
