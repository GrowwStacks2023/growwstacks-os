"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

import {
  recordFileAttachment,
  recordLinkAttachment,
  type AttachmentEntityType,
} from "./actions";
import { storagePathFor } from "./storage";

// Local-only staged items: live in client state until the parent entity has
// been created and we know its id. Then commitStagedAttachments() walks the
// list and turns each item into a real Storage object + attachment row.
export type StagedFile = {
  // Unique-within-this-session key for React's list reconciliation.
  key: string;
  kind: "file";
  file: File;
  label: string;
};

export type StagedLink = {
  key: string;
  kind: "link";
  url: string;
  label: string;
};

export type StagedItem = StagedFile | StagedLink;

function freshKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  items: StagedItem[];
  onChange: (items: StagedItem[]) => void;
  disabled?: boolean;
};

// UI for staging files + links to be attached after the parent entity is
// created. Visually consistent with the live AttachmentsPanel but does not
// touch the network — that happens in commitStagedAttachments below.
export function StagedAttachments({ items, onChange, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  function stageFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    onChange([
      ...items,
      { key: freshKey(), kind: "file", file, label: fileLabel.trim() },
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileLabel("");
  }

  function stageLink() {
    const url = linkUrl.trim();
    if (!url) return;
    onChange([
      ...items,
      { key: freshKey(), kind: "link", url, label: linkLabel.trim() },
    ]);
    setLinkUrl("");
    setLinkLabel("");
  }

  function remove(key: string) {
    onChange(items.filter((it) => it.key !== key));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Attachments (optional)
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Add file
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staged-file">File</Label>
            <Input
              id="staged-file"
              ref={fileInputRef}
              type="file"
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staged-file-label">Label (optional)</Label>
            <Input
              id="staged-file-label"
              type="text"
              value={fileLabel}
              onChange={(e) => setFileLabel(e.target.value)}
              placeholder="Proposal v2"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stageFile}
            disabled={disabled}
          >
            Stage file
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Add link
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staged-link-url">URL</Label>
            <Input
              id="staged-link-url"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://loom.com/share/…"
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staged-link-label">Label (optional)</Label>
            <Input
              id="staged-link-label"
              type="text"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Demo walkthrough"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stageLink}
            disabled={disabled}
          >
            Stage link
          </Button>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {it.kind === "file" ? "File" : "Link"}
                </Badge>
                <span className="truncate text-sm">
                  {it.kind === "file"
                    ? it.label || it.file.name
                    : it.label || it.url}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {it.kind === "file"
                    ? `${it.file.name} · ${formatBytes(it.file.size)}`
                    : it.url}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(it.key)}
                disabled={disabled}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Stage files and links here — they&apos;ll be attached after the entity is created.
        </p>
      )}
    </div>
  );
}

// Commit all staged items against a freshly-created entity. Tries every item;
// returns a summary the caller uses to surface partial-failure warnings
// without blocking the navigation. The entity is NEVER rolled back if an
// attachment fails — losing a partially-attached entity would be worse than
// surfacing a warning.
export type CommitResult = {
  succeeded: number;
  failed: { item: StagedItem; reason: string }[];
};

export async function commitStagedAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
  items: StagedItem[]
): Promise<CommitResult> {
  const failed: CommitResult["failed"] = [];
  let succeeded = 0;

  const supabase = createClient();

  for (const item of items) {
    if (item.kind === "file") {
      const storagePath = storagePathFor(entityType, entityId, item.file.name);
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(storagePath, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });
      if (uploadError) {
        failed.push({ item, reason: uploadError.message });
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("attachments").getPublicUrl(storagePath);

      const result = await recordFileAttachment({
        entityType,
        entityId,
        fileName: item.file.name,
        storagePath,
        publicUrl,
        mimeType: item.file.type || null,
        sizeBytes: item.file.size,
        label: item.label || null,
      });
      if (!result.ok) {
        await supabase.storage.from("attachments").remove([storagePath]);
        failed.push({ item, reason: result.error });
        continue;
      }
      succeeded += 1;
    } else {
      const result = await recordLinkAttachment({
        entityType,
        entityId,
        url: item.url,
        label: item.label || null,
      });
      if (!result.ok) {
        failed.push({ item, reason: result.error });
        continue;
      }
      succeeded += 1;
    }
  }

  return { succeeded, failed };
}
