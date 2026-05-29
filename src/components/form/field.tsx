import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// One field = label above input, optional description below. Used for
// every text-ish field across every create form. Vertical rhythm:
// 8px between label and input, 8px between input and description.
//
// Labels are 14px / 500 / foreground (NOT muted) so they read clearly
// at the new body size. Required → small blue asterisk. Optional → tiny
// muted pill so users can skim what's mandatory.
export function Field({
  id,
  label,
  description,
  required,
  optional,
  error,
  children,
  className,
}: {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label
        htmlFor={id}
        className="text-[14px] font-medium tracking-[-0.005em] text-foreground"
      >
        <span>{label}</span>
        {required ? (
          <span
            aria-hidden
            className="ml-1 text-brand-600"
            title="Required"
          >
            *
          </span>
        ) : null}
        {optional ? (
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Optional
          </span>
        ) : null}
      </Label>
      {children}
      {description && !error ? (
        <p className="text-[13px] leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="text-[13px] leading-snug text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
