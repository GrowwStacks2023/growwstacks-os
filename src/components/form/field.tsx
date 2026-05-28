import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// One field = label above input, optional description below. Used for
// every text-ish field across every create form. The visual rhythm comes
// from a single consistent gap (10px) between label and control, and a
// 6px gap between control and description.
//
// Pass `required` only when the underlying input is genuinely required —
// the asterisk gives sales/dev a quick visual scan of what they have to
// fill in.
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
        className="text-[13px] font-medium tracking-tight text-foreground/85"
      >
        <span>{label}</span>
        {required ? (
          <span
            aria-hidden
            className="ml-1 text-sienna-600"
            title="Required"
          >
            *
          </span>
        ) : null}
        {optional ? (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            (optional)
          </span>
        ) : null}
      </Label>
      {children}
      {description && !error ? (
        <p className="text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs leading-snug text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
