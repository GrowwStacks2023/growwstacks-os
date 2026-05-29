import { cn } from "@/lib/utils";

// Single outer container every dashboard page wraps its contents in.
// Sets the consistent column width, vertical rhythm, and section
// spacing so pages line up visually. If you want different padding on
// one page — push back; the point is sameness.
export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-10",
        className
      )}
    >
      {children}
    </div>
  );
}

// Labelled section within a page. Heading uses the display font one
// step down from the page title (~20px). Optional description sits
// below it at the small body size.
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-5", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title ? (
              <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.012em] text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[14px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
