import { cn } from "@/lib/utils";

import { Breadcrumbs, type Crumb } from "./breadcrumbs";

// The shared top-of-page header used across EVERY dashboard route. Per
// "Don't Make Me Think" + Refactoring UI:
//   - Title left in the display font (Fraunces), description below it.
//   - Primary action ALWAYS top-right in the same spot — so muscle memory
//     transfers between pages.
//   - Breadcrumbs above the title so the user can navigate up one level
//     without scanning the page.
//   - A subtle 2px sienna rule (accent-rule) under the title gives the
//     editorial mark on every page.
//
// Optional `meta` slot to the right of the title for status/role chips
// on detail pages (e.g. a project's status badge). Sits next to the
// title rather than competing with the primary action.
export function PageHeader({
  title,
  description,
  breadcrumbs,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: ReadonlyArray<Crumb>;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs trail={breadcrumbs} />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="accent-rule font-display text-[28px] sm:text-[32px] font-medium leading-[1.1] tracking-[-0.012em] text-foreground">
              {title}
            </h1>
            {meta ? (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                {meta}
              </div>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        ) : null}
      </div>
    </header>
  );
}
