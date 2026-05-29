import { cn } from "@/lib/utils";

import { Breadcrumbs, type Crumb } from "./breadcrumbs";

// Shared top-of-page header on every dashboard route. Per "Don't Make
// Me Think" + Refactoring UI:
//   - Title left in Bricolage Grotesque at 28–32px, generous weight.
//   - Primary action ALWAYS top-right.
//   - Breadcrumbs above the title for orientation + one-tap back-nav.
//   - Description below the title at the new body scale (~16px).
//
// Optional `meta` slot to the right of the title for status badges on
// detail pages (e.g. project status). Sits next to the title rather
// than competing with the primary action on the far right.
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
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] sm:text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-ink-900">
              {title}
            </h1>
            {meta ? (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                {meta}
              </div>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-500">
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
