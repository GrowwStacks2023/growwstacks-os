"use client";

import {
  Building2,
  CheckSquare,
  CreditCard,
  FolderKanban,
  Handshake,
  Home,
  Plug,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { canShowInSidebar, NAV_LINKS, type NavLink, type Role } from "@/lib/access";
import { cn } from "@/lib/utils";

const ICONS: Record<NavLink["icon"], LucideIcon> = {
  Home,
  Building2,
  Users,
  Handshake,
  FolderKanban,
  CreditCard,
  CheckSquare,
  UserCog,
  Plug,
};

// Spec v3 sidebar:
//   - 264px wide
//   - dark navy gradient (.sidebar-bg) with thin green-glow right edge
//   - blue→green gradient brand-mark tile (the .brand-mark utility)
//   - active item: .sidebar-active-pill (blue/green gradient + 3px green
//     inset glow); icon turns --green-500
//   - inactive item: rgba(255,255,255,0.05) hover, white text
export function Sidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const visibleLinks = NAV_LINKS.filter((link) =>
    canShowInSidebar(role, link.section)
  );

  return (
    <aside
      // sticky + h-svh + overflow-y-auto keeps the sidebar pinned to the
      // viewport while the page scrolls. The internal overflow lets long
      // nav lists scroll within the sidebar without affecting the main
      // content. We use `self-start` (via height + sticky) so the aside
      // doesn't stretch to the row's tall content height.
      className="sidebar-bg sticky top-0 z-20 flex h-svh w-[264px] shrink-0 flex-col overflow-y-auto text-[#a9c2da]"
      style={{
        boxShadow: "inset -1px 0 0 rgba(22, 192, 136, 0.18)",
      }}
    >
      {/* Brand block — gradient G monogram + wordmark */}
      <div className="px-5 py-6">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <span
            aria-hidden
            className="brand-mark grid size-9 place-items-center rounded-[10px] transition-transform group-hover:scale-105"
          >
            <span className="font-display text-[18px] font-bold leading-none">
              G
            </span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[16px] font-semibold tracking-[-0.02em] text-white">
              GrowwStacks
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Operating System
            </span>
          </span>
        </Link>
      </div>

      {/* Workspace eyebrow */}
      <div className="px-5 pb-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
          Workspace
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pb-4 pt-1">
        {visibleLinks.map((link) => {
          const Icon = ICONS[link.icon];
          const isActive =
            link.href === "/dashboard"
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-semibold transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--green-500)]/50",
                isActive
                  ? "sidebar-active-pill text-white"
                  : "text-white/75 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "size-[17px] shrink-0 transition-colors",
                  isActive
                    ? "text-[var(--green-500)]"
                    : "text-white/55 group-hover:text-white"
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
