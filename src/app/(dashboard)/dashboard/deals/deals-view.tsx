"use client";

import { useState } from "react";

import { DealsBoard, type DealCard } from "./deals-board";
import { DealsList } from "./deals-list";
import { DealsViewToggle, type DealsView as Mode } from "./deals-view-toggle";

// Client-side shell so the Board / List toggle can flip view without
// reloading the page. State is local — there's no reason to persist this
// to the URL; sales reps pick once and stick.
export function DealsView({
  deals,
  rightSlot,
}: {
  deals: DealCard[];
  rightSlot?: React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("board");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <DealsViewToggle value={mode} onChange={setMode} />
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
      {mode === "board" ? (
        <DealsBoard initialDeals={deals} />
      ) : (
        <DealsList deals={deals} />
      )}
    </div>
  );
}
