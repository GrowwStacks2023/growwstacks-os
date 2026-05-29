"use client";

import { Paperclip } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// Inline collapsible wrapper around the existing AttachmentsCard. The card
// itself is a server component fetched on the project page (eager render,
// matching what every other detail page already does); this client island
// only flips visibility via useState. No new server action, no new fetch.
//
// Sits inside each milestone card on /dashboard/projects/[id]. Closed by
// default so the card stays compact; the count badge tells users when
// there's something to open without forcing them to.
export function MilestoneAttachmentsToggle({
  initialCount,
  children,
}: {
  initialCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Paperclip className="size-3.5" />
          Attachments
          {initialCount > 0 ? (
            <span className="ml-1 font-numeric text-ink-500">
              · {initialCount}
            </span>
          ) : null}
        </Button>
      </div>
      {open ? <div>{children}</div> : null}
    </div>
  );
}
