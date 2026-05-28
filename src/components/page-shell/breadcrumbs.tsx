import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// One breadcrumb entry. Pass href to make it a link; omit href for the
// terminal (current page) crumb.
export type Crumb = {
  label: string;
  href?: string;
};

// Persistent navigation trail at the top of every dashboard page. Per
// "Don't Make Me Think" — the user should always know where they are and
// how to get back one level. Detail pages especially need this since
// they're the deepest the app goes.
//
// Convention: caller passes the full trail (Dashboard › Section › Detail).
// The last crumb renders as plain text — it's where the user already is,
// no link needed. Intermediate crumbs link back up the tree.
export function Breadcrumbs({
  trail,
  className,
}: {
  trail: ReadonlyArray<Crumb>;
  className?: string;
}) {
  if (trail.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex flex-wrap items-center gap-1 text-xs", className)}
    >
      {trail.map((c, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {c.href && !isLast ? (
              <Link
                href={c.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={
                  isLast
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }
              >
                {c.label}
              </span>
            )}
            {!isLast ? (
              <ChevronRight
                aria-hidden
                className="size-3 text-muted-foreground/60"
              />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
