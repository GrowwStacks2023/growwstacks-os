import { cn } from "@/lib/utils";

// Bottom row of a form. Primary action right, secondary/cancel beside
// it. Stacks on mobile in the same order (primary at top, secondary
// below) so the most important button is always reachable.
//
// The hairline border on top separates the actions from the field
// stack — small but matters; without it the buttons feel "loose".
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-2 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
