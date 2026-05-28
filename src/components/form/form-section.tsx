import { cn } from "@/lib/utils";

// A labelled group within a form. Two kinds of headings are supported:
// inline (small, left-rule) and prominent (display title). Default is
// inline because most forms have one big chunk; the prominent variant is
// for forms with two-or-more discrete sections (e.g. Task: details +
// staged attachments).
export function FormSection({
  title,
  description,
  variant = "inline",
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "inline" | "prominent";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-5", className)}>
      {title || description ? (
        <header className="flex flex-col gap-1.5">
          {title ? (
            variant === "prominent" ? (
              <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            ) : (
              <h4 className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {title}
              </h4>
            )
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
