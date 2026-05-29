"use client";

import { LayoutGrid, List } from "lucide-react";

import { cn } from "@/lib/utils";

export type DealsView = "board" | "list";

// Spec-style segmented control sitting in the deals page header. State is
// lifted into the parent client component (DealsView) so the actual data
// rendering can switch between Board and List without remounting either.
export function DealsViewToggle({
  value,
  onChange,
}: {
  value: DealsView;
  onChange: (v: DealsView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Deals view"
      className="inline-flex items-center gap-1 rounded-[10px] border border-line bg-white p-1 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
    >
      <button
        role="tab"
        type="button"
        aria-selected={value === "board"}
        onClick={() => onChange("board")}
        className={cn(
          "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-all",
          value === "board"
            ? "btn-primary-gradient text-white"
            : "text-ink-500 hover:text-ink-900"
        )}
      >
        <LayoutGrid className="size-3.5" />
        Board
      </button>
      <button
        role="tab"
        type="button"
        aria-selected={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-all",
          value === "list"
            ? "btn-primary-gradient text-white"
            : "text-ink-500 hover:text-ink-900"
        )}
      >
        <List className="size-3.5" />
        List
      </button>
    </div>
  );
}
