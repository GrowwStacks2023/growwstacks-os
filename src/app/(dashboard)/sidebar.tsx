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

const ICONS: Record<NavLink["icon"], LucideIcon> = {
  Home,
  Building2,
  Users,
  Handshake,
  FolderKanban,
  CreditCard,
  CheckSquare,
};

// Role threaded down from the dashboard layout. Sidebar is a client
// component so usePathname can drive the active-state highlight; the
// gating is just canAccess() filtering NAV_LINKS.
//
// The sidebar is the BRAND. It's the deep navy chrome that anchors the
// product identity the moment the app opens.
export function Sidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const visibleLinks = NAV_LINKS.filter((link) =>
    canAccess(role, link.section)
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/*
        Brand block — white G monogram tile on the deep-blue sidebar.
        The tile sits on a thin highlight ring for crispness against the
        deep navy. Wordmark in Bricolage Grotesque.
      */}
      <div className="px-5 py-6">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-md bg-white text-brand-700 ring-1 ring-white/20 shadow-[0_1px_2px_0_rgba(0,0,0,0.25)] transition-transform group-hover:scale-105"
          >
            <span className="font-display text-[17px] font-bold leading-none">
              G
            </span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[16px] font-semibold tracking-tight text-white">
              GrowwStacks
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Operating System
            </span>
          </span>
        </Link>
      </div>

      {/* Workspace eyebrow */}
      <div className="px-5 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Workspace
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
        {visibleLinks.map((link) => {
          const Icon = ICONS[link.icon];
          const isActive =
            link.href === "/dashboard"
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          // Active link: a brand-700 pill with a white left mark — reads
          // as "you are here" against the deep navy chrome.
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group sidebar-focus-ring relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors",
                isActive
                  ? "bg-brand-700 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-[3px] rounded-r-full bg-white"
                />
              ) : null}
              <Icon
                className={cn(
                  "size-[17px] shrink-0",
                  isActive
                    ? "text-white"
                    : "text-white/60 group-hover:text-white"
                )}
              />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom footer */}
      <div className="border-t border-white/10 px-5 py-3.5">
        <p className="text-[11px] text-white/45">
          GrowwStacks <span className="text-white/60">·</span> Internal v1
        </p>
      </div>
    </aside>
  );
}
