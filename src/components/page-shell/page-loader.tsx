import { cn } from "@/lib/utils";

// Branded loader shown by Next's app-router when a `loading.tsx` is
// present. Instant feedback during navigation while the server component
// is still fetching.
//
// Identity v2: white G monogram tile (matches the sidebar mark) on a
// deep brand-blue puck. Two soft pinging rings stagger around it for a
// composed "breathing" rhythm rather than a nervous spinner.
export function PageLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-6",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative grid size-20 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border border-brand-300/50 animate-ping [animation-duration:2.6s]"
        />
        <span
          aria-hidden
          className="absolute inset-2.5 rounded-full border border-brand-400/40 animate-ping [animation-duration:2.6s] [animation-delay:0.7s]"
        />
        <span className="relative grid size-12 place-items-center rounded-md bg-brand-700 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_4px_14px_-6px_color-mix(in_oklch,var(--brand-900)_70%,transparent)]">
          <span className="font-display text-[22px] font-bold leading-none">
            G
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-brand-500 animate-pulse [animation-duration:1.6s]"
        />
        <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
