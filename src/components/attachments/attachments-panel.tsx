"use client";

import { useRef, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userDisplay } from "@/lib/display";

import {
  deleteAttachment,
  recordLinkAttachment,
  uploadAndRecordFile,
} from "./actions";
import type { AttachmentEntityType } from "./actions";
import type { AttachmentRow } from "./fetch";

type Props = {
  entityType: AttachmentEntityType;
  entityId: string;
  attachments: AttachmentRow[];
  currentUserId: string | null;
  currentUserRole: string | null;
  // Path to revalidate after an upload/delete so the list refreshes.
  revalidatePath: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function AttachmentsPanel({
  entityType,
  entityId,
  attachments,
  currentUserId,
  currentUserRole,
  revalidatePath: revalidate,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [, startTransition] = useTransition();

  const isAdmin = currentUserRole === "admin";

  async function handleUploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Pick a file to upload.");
      return;
    }

    setWorking(true);

    // Hand the file to the server action via FormData. The action posts
    // it to the n8n webhook, parses the Drive link out of the response,
    // and inserts the attachment row. NO bytes hit Supabase Storage
    // anymore — the bucket is dormant for new uploads.
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("entityType", entityType);
    fd.append("entityId", entityId);
    if (fileLabel.trim()) fd.append("label", fileLabel.trim());
    fd.append("revalidate", revalidate);

    const result = await uploadAndRecordFile(fd);
    setWorking(false);

    if (!result.ok) {
      // Webhook failure / DB rejection: no row was inserted. Surface the
      // server message so the user can decide whether to retry.
      setError(result.error);
      return;
    }

    setFileLabel("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    startTransition(() => {});
  }

  async function handleAddLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!linkUrl.trim()) {
      setError("Link URL is required.");
      return;
    }

    setWorking(true);
    const result = await recordLinkAttachment({
      entityType,
      entityId,
      url: linkUrl.trim(),
      label: linkLabel.trim() ? linkLabel.trim() : null,
      revalidate,
    });
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLinkUrl("");
    setLinkLabel("");
    startTransition(() => {});
  }

  async function handleDelete(attachmentId: string) {
    setError(null);
    const ok = window.confirm("Delete this attachment? This can't be undone.");
    if (!ok) return;

    const result = await deleteAttachment(attachmentId, revalidate);
    if (!result.ok) {
      setError(result.error);
    } else {
      startTransition(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <form
          onSubmit={handleUploadFile}
          className="flex flex-col gap-3 rounded-md border p-3"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Upload file
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`attachment-file-${entityId}`}>File</Label>
            <Input
              id={`attachment-file-${entityId}`}
              ref={fileInputRef}
              type="file"
              disabled={working}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`attachment-file-label-${entityId}`}>
              Label (optional)
            </Label>
            <Input
              id={`attachment-file-label-${entityId}`}
              type="text"
              value={fileLabel}
              onChange={(e) => setFileLabel(e.target.value)}
              placeholder="Proposal v2"
              disabled={working}
            />
          </div>
          <Button type="submit" disabled={working}>
            {working ? "Uploading…" : "Upload file"}
          </Button>
        </form>

        <form
          onSubmit={handleAddLink}
          className="flex flex-col gap-3 rounded-md border p-3"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Add link
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`attachment-link-url-${entityId}`}>URL</Label>
            <Input
              id={`attachment-link-url-${entityId}`}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://loom.com/share/…"
              disabled={working}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`attachment-link-label-${entityId}`}>
              Label (optional)
            </Label>
            <Input
              id={`attachment-link-label-${entityId}`}
              type="text"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Demo walkthrough"
              disabled={working}
            />
          </div>
          <Button type="submit" variant="outline" disabled={working}>
            {working ? "Adding…" : "Add link"}
          </Button>
        </form>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No attachments yet. Upload a file or paste a link above.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {attachments.map((a) => {
            const uploaderDisplay = userDisplay(a.uploader, "Unknown");
            const canDelete = isAdmin || a.uploaded_by === currentUserId;
            const isLink = a.kind === "link";
            // Open: links always live in `url`; files prefer the new
            // Drive `url` when present, falling back to the legacy
            // bucket `public_url` so old rows still open.
            const href = a.url ?? a.public_url ?? null;
            const titleText = a.label ?? a.file_name;
            // For links without a label, file_name was set to the URL itself
            // (see recordLinkAttachment); skip the secondary line in that
            // case to avoid showing the URL twice.
            const showSecondary =
              a.label && a.label !== a.file_name && !isLink;

            return (
              <li
                key={a.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {isLink ? "Link" : "File"}
                    </Badge>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {titleText}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-medium">
                        {titleText}
                      </span>
                    )}
                    {showSecondary ? (
                      <span className="truncate text-xs text-muted-foreground">
                        ({a.file_name})
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isLink ? (
                      <>
                        <span className="truncate">{a.url}</span> ·{" "}
                      </>
                    ) : (
                      <>{formatBytes(a.size_bytes)} · </>
                    )}
                    {uploaderDisplay} ·{" "}
                    {dateFormatter.format(new Date(a.created_at))}
                    {!isLink && a.mime_type ? ` · ${a.mime_type}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {href ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      render={
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      }
                    />
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(a.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
