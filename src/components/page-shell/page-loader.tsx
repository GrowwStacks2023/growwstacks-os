import { cn } from "@/lib/utils";

// Branded loader shown by Next's app-router when a `loading.tsx` is
// present. Identity v3: gradient (blue→green) G monogram tile with two
// blue-glow pinging rings.
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
          className="absolute inset-0 rounded-full border border-blue-600/40 animate-ping [animation-duration:2.6s]"
        />
        <span
          aria-hidden
          className="absolute inset-2.5 rounded-full border border-green-500/40 animate-ping [animation-duration:2.6s] [animation-delay:0.7s]"
        />
        <span className="brand-mark relative grid size-12 place-items-center rounded-[12px]">
          <span className="font-display text-[22px] font-bold leading-none text-white">
            G
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-green-500 animate-pulse [animation-duration:1.6s]"
        />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
          {label}
        </span>
      </div>
    </div>
  );
}
