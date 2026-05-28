"use client";

import {
  Building2,
  CheckSquare,
  CreditCard,
  FolderKanban,
  Handshake,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { canAccess, NAV_LINKS, type NavLink, type Role } from "@/lib/access";
import { cn } from "@/lib/utils";

// Resolve the string icon name from NAV_LINKS into a Lucide component.
// Kept here rather than in access.ts so that module stays JSX-free (and
// can be imported anywhere, including server-only code).
const ICONS: Record<NavLink["icon"], LucideIcon> = {
  Home,
  Building2,
  Users,
  Handshake,
  FolderKanban,
  CreditCard,
  CheckSquare,
};

// Role threaded down from the dashboard layout (server component reads
// it from public.users). Sidebar stays a client component because it
// needs usePathname for active-state highlighting; the gating is just
// canAccess() filtering the NAV_LINKS list.
export function Sidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const visibleLinks = NAV_LINKS.filter((link) =>
    canAccess(role, link.section)
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand block — editorial wordmark in Fraunces with a sienna
          monogram tile. The tile has a hairline inner highlight to read
          as a stamp rather than a flat swatch. */}
      <div className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-sienna-600 text-sienna-50 shadow-[inset_0_1px_0_0_color-mix(in_oklch,white_30%,transparent),0_1px_0_0_color-mix(in_oklch,var(--sienna-900)_40%,transparent)] transition-transform group-hover:-rotate-[3deg]"
          >
            <span className="font-display text-[15px] font-semibold leading-none">
              G
            </span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              GrowwStacks
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              OS
            </span>
          </span>
        </Link>
      </div>

      {/* Nav cluster label — gives the column structure that an editorial
          workspace would have. Tiny uppercase eyebrow above the list. */}
      <div className="px-5 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Workspace
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        {visibleLinks.map((link) => {
          const Icon = ICONS[link.icon];
          const isActive =
            link.href === "/dashboard"
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          // Active link: sienna-tinted pill with a 2px sienna mark on the
          // left edge — reads like a bookmark, not a plain selected state.
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 -translate-y-1/2 w-[2px] rounded-full bg-sienna-600"
                />
              ) : null}
              <Icon
                className={cn(
                  "size-[15px] shrink-0",
                  isActive
                    ? "text-sienna-700"
                    : "text-muted-foreground/80 group-hover:text-foreground"
                )}
              />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom rule — a tiny editorial signoff. Pure decoration. */}
      <div className="border-t border-sidebar-border/70 px-5 py-3">
        <p className="text-[10px] text-muted-foreground/70">
          <span className="font-display italic">v1</span> · internal
        </p>
      </div>
    </aside>
  );
}
