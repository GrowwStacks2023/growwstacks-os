import { cn } from "@/lib/utils";

// Branded GrowwStacks OS loader. Shown by Next's app-router whenever a
// loading.tsx is present in the current route segment — instant feedback
// during navigation while the server component is still fetching.
//
// The loader picks up the editorial brand mark — a sienna G monogram in
// the display font, with two slow concentric rings ("watch the brand
// breathe" not "watch a spinner"). On-brand, calm, distinct.
export function PageLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-5",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/*
        Brand monogram in a soft pad with two pulsing sienna rings around
        it. The rings stagger with animation-delay so the motion looks
        composed, not nervous.
      */}
      <div className="relative grid size-16 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border border-sienna-300/60 animate-ping [animation-duration:2.4s]"
        />
        <span
          aria-hidden
          className="absolute inset-2 rounded-full border border-sienna-400/40 animate-ping [animation-duration:2.4s] [animation-delay:0.6s]"
        />
        <span className="relative grid size-10 place-items-center rounded-md bg-sienna-600 text-sienna-50 shadow-[inset_0_1px_0_0_color-mix(in_oklch,white_30%,transparent),0_1px_0_0_color-mix(in_oklch,var(--sienna-900)_40%,transparent)]">
          <span className="font-display text-[18px] font-semibold leading-none">
            G
          </span>
        </span>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
