import { cn } from "@/lib/utils";

// Two-column field grid that collapses to one column on narrow screens.
// Equal-width columns by default; the gap matches the vertical rhythm
// between rows so the grid feels deliberate, not pasted in.
//
// Use for paired fields like Status + Priority, Start + Target end,
// Value (INR) + Value (USD).
export function FormRow({
  children,
  className,
  cols = 2,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}
