"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { userDisplay } from "@/lib/display";
import {
  DEAL_SOURCE,
  DEAL_STAGE,
  DEAL_STAGE_ORDER,
} from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

import { updateDealStage } from "./actions";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type DealSource = Database["public"]["Enums"]["deal_source"];

export type DealCard = {
  id: string;
  title: string;
  stage: DealStage;
  source: DealSource;
  value_inr: number | null;
  value_usd: number | null;
  company: { name: string } | null;
  owner: { name: string | null; email: string } | null;
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function dealValue(d: Pick<DealCard, "value_inr" | "value_usd">) {
  const inr = d.value_inr ? Number(d.value_inr) : 0;
  const usd = d.value_usd ? Number(d.value_usd) : 0;
  if (inr > 0) return { display: inrFormatter.format(inr), inr, usd: 0 };
  if (usd > 0) return { display: usdFormatter.format(usd), inr: 0, usd };
  return { display: "—", inr: 0, usd: 0 };
}

function stageTotalLabel(inr: number, usd: number) {
  const parts: string[] = [];
  if (inr > 0) parts.push(inrFormatter.format(inr));
  if (usd > 0) parts.push(usdFormatter.format(usd));
  return parts.length === 0 ? "—" : parts.join(" + ");
}

// Visual card. Shared by the column-rendered card AND the drag overlay.
function DealCardView({
  deal,
  dragging,
}: {
  deal: DealCard;
  dragging?: boolean;
}) {
  const value = dealValue(deal);
  const sourceVisual = DEAL_SOURCE[deal.source];
  const ownerDisplay = userDisplay(deal.owner, "Unassigned");
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-[12px] border border-line bg-white p-3.5",
        "shadow-[0_1px_2px_rgba(10,37,64,0.05),0_1px_3px_rgba(10,37,64,0.06)]",
        "transition-shadow",
        dragging
          ? "shadow-[0_12px_28px_-12px_rgba(10,37,64,0.35),0_4px_10px_rgba(10,37,64,0.12)] ring-1 ring-blue-600/30"
          : "hover:shadow-[0_6px_20px_-8px_rgba(10,37,64,0.18),0_2px_6px_rgba(10,37,64,0.06)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
          {deal.title}
        </h3>
        <Badge
          variant={sourceVisual.variant}
          className={`${sourceVisual.className} shrink-0`}
        >
          {sourceVisual.label}
        </Badge>
      </div>
      <p className="line-clamp-1 text-[13px] text-ink-500">
        {deal.company?.name ?? "—"}
      </p>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="font-numeric text-[14px] font-semibold text-ink-900">
          {value.display}
        </span>
        <span
          className="truncate text-[12px] text-ink-400"
          title={ownerDisplay}
        >
          {ownerDisplay}
        </span>
      </div>
    </div>
  );
}

// Draggable wrapper around the card. We use a small drag-handle pattern:
// the entire card is the handle, but the click target (the Link) is
// surfaced separately so taps still open the detail page when no drag
// happens. dnd-kit's PointerSensor distinguishes click from drag via a
// small activation distance.
function DraggableDeal({
  deal,
  disabled,
}: {
  deal: DealCard;
  disabled: boolean;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: deal.id,
    data: { stage: deal.stage },
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="touch-none"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <Link
          href={`/dashboard/deals/${deal.id}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 rounded-[12px]"
          onClick={(e) => {
            // Suppress navigation if a drag was in progress. dnd-kit fires
            // pointerup before click — if we got here without a drag, let
            // the link work. Otherwise the user's drag would also trigger
            // a navigation. We let it through; @dnd-kit cancels click on
            // drag-end via the pointer sensor's activation distance.
            if (isDragging) e.preventDefault();
          }}
        >
          <DealCardView deal={deal} />
        </Link>
      </div>
    </li>
  );
}

function DropColumn({
  stage,
  children,
  isOver,
}: {
  stage: DealStage;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `col:${stage}` });
  return (
    <div
      ref={setNodeRef}
      data-stage={stage}
      className={cn(
        "flex min-h-[120px] flex-col gap-2.5 rounded-[10px] p-1 transition-colors",
        isOver ? "bg-blue-100/60 ring-2 ring-blue-600/40" : ""
      )}
    >
      {children}
    </div>
  );
}

export function DealsBoard({ initialDeals }: { initialDeals: DealCard[] }) {
  const [deals, setDeals] = useState<DealCard[]>(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    // 6px activation distance keeps single-clicks (open detail) working —
    // anything below this just navigates via the wrapping <Link>.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const byStage = new Map<DealStage, DealCard[]>();
  for (const s of DEAL_STAGE_ORDER) byStage.set(s, []);
  for (const d of deals) byStage.get(d.stage)?.push(d);

  const active = deals.find((d) => d.id === activeId) ?? null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setError(null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverStage(null);
    const { active, over } = e;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith("col:")) return;
    const target = overId.slice(4) as DealStage;

    const dealId = String(active.id);
    const current = deals.find((d) => d.id === dealId);
    if (!current || current.stage === target) return;

    const previous = current.stage;

    // Optimistic update — rerender into the new column immediately.
    setDeals((rows) =>
      rows.map((r) => (r.id === dealId ? { ...r, stage: target } : r))
    );

    startTransition(async () => {
      const result = await updateDealStage(dealId, target);
      if (!result.ok) {
        // Roll back on any failure (RLS denial, network, validation).
        setDeals((rows) =>
          rows.map((r) => (r.id === dealId ? { ...r, stage: previous } : r))
        );
        setError(result.error);
      }
    });
  }

  function handleDragOver(e: { over: { id: string | number } | null }) {
    const id = e.over ? String(e.over.id) : null;
    if (id && id.startsWith("col:")) setOverStage(id.slice(4) as DealStage);
    else setOverStage(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div
          role="alert"
          className="rounded-[10px] border border-red-100 bg-red-100/40 px-3 py-2 text-[13px] font-medium text-red-600"
        >
          {error}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div
          className="-mx-8 overflow-x-auto px-8 pb-4"
          aria-label="Deals pipeline"
        >
          <div className="flex gap-4 min-w-max">
            {DEAL_STAGE_ORDER.map((stage) => {
              const stageDeals = byStage.get(stage) ?? [];
              const stageVisual = DEAL_STAGE[stage];
              let inr = 0;
              let usd = 0;
              for (const d of stageDeals) {
                const v = dealValue(d);
                inr += v.inr;
                usd += v.usd;
              }
              return (
                <section
                  key={stage}
                  className="flex w-[300px] shrink-0 flex-col gap-3 rounded-[14px] bg-[#eef4fb] p-3"
                  aria-label={`${stageVisual.label} column`}
                >
                  <header className="flex items-start justify-between gap-2 px-1 pt-1">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={stageVisual.variant}
                          className={stageVisual.className}
                        >
                          {stageVisual.label}
                        </Badge>
                        <span className="rounded-full bg-white px-2 py-0.5 font-numeric text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-line">
                          {stageDeals.length}
                        </span>
                      </div>
                      <p className="font-numeric text-[12px] font-medium text-ink-500">
                        {stageTotalLabel(inr, usd)}
                      </p>
                    </div>
                  </header>

                  <DropColumn stage={stage} isOver={overStage === stage}>
                    {stageDeals.length === 0 ? (
                      <div className="flex h-24 items-center justify-center rounded-[10px] border border-dashed border-line bg-white/60 text-[13px] text-ink-400">
                        Drop a deal here
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {stageDeals.map((deal) => (
                          <DraggableDeal
                            key={deal.id}
                            deal={deal}
                            disabled={isPending}
                          />
                        ))}
                      </ul>
                    )}
                  </DropColumn>
                </section>
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="w-[280px]">
              <DealCardView deal={active} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
