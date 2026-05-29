// Centralized role-based access matrix. Imported by:
//   - the sidebar (to filter nav links)
//   - the per-route-group layouts (to redirect unauthorized users)
//   - the project pages (to branch between full and read-only renders)
//
// One source of truth: if you want to change who can see what, change it
// HERE. RLS still enforces at the DB layer; this module makes the UI match.
//
// Plain module of pure functions. NOT a "use server" file — these are
// callable from both client and server code paths.

import type { Database } from "@/types/database";

export type Role = Database["public"]["Enums"]["user_role"];

// Logical sections the app exposes. These are NOT URL paths — they're the
// concept being gated. A section may map to several routes (e.g.
// /dashboard/projects and /dashboard/projects/[id] both fall under the
// "projects" section).
export type Section =
  | "dashboard"
  | "companies"
  | "contacts"
  | "deals"
  | "projects"
  | "tasks"
  | "payments"
  | "users"
  | "integrations"
  | "portal";

// Per-section role lists. Keep these in sync with the matrix in the task
// brief AND with the RLS policies in supabase/migrations/. If you find
// they disagree, fix the RLS first.
//
// "projects" includes sales because they get a READ-ONLY summary view
// (see canEditProjectArea below). RLS does not allow sales to write
// projects/milestones/tasks anyway.
//
// "portal" is the future client-only space. We list `client` here so a
// later /dashboard/portal route can use canAccess('portal', role).
export const SECTION_ROLES: Record<Section, ReadonlyArray<Role>> = {
  dashboard: ["admin", "sales", "pm", "developer"],
  companies: ["admin", "sales", "pm"],
  contacts: ["admin", "sales", "pm"],
  deals: ["admin", "sales", "pm"],
  projects: ["admin", "sales", "pm", "developer"],
  tasks: ["admin", "sales", "pm", "developer"],
  payments: ["admin", "sales", "pm"],
  // Admin surfaces — invite users, manage API keys for external integrations.
  users: ["admin"],
  integrations: ["admin"],
  portal: ["client"],
};

// Primary gate used by both the sidebar (to hide nav) and the per-route
// layouts (to redirect). A null role is never allowed — unauthenticated
// callers should already have been bounced by the dashboard layout.
export function canAccess(role: Role | null, section: Section): boolean {
  if (!role) return false;
  return (SECTION_ROLES[section] as ReadonlyArray<string>).includes(role);
}

// Sales is the only "view but don't edit" role for projects. This helper
// is the single place that distinction is encoded — both the project list
// (hide "New project" button) and the project detail (hide add buttons,
// task drilldown, attachments upload) should branch through it.
//
// admin / pm: full edit.
// developer: their RLS scope already limits them; treat as edit-capable
//   for the pages they can reach (they can update tasks they're assigned
//   to).
// sales: read-only.
// client: no project access at all (canAccess handles the redirect first).
export function canEditProjectArea(role: Role | null): boolean {
  if (!role) return false;
  return role === "admin" || role === "pm" || role === "developer";
}

// Convenience: is the caller a client? Used by the dashboard layout to
// short-circuit them to the portal placeholder before any data page
// renders.
export function isClient(role: Role | null): boolean {
  return role === "client";
}

// ─── Sidebar nav definition ────────────────────────────────────────────
// The sidebar imports this list verbatim. Section is the access-check
// key; the sidebar runs canAccess(role, link.section) before rendering.
// Keeping the definition here means a future "add a new nav link" lives
// next to the matrix it has to satisfy — no drift between the two.
export type NavLink = {
  href: string;
  label: string;
  section: Section;
  // Lucide icon name. Kept as a string here (a plain module) so this file
  // stays free of React/JSX imports; the sidebar resolves the icon at
  // render time.
  icon:
    | "Home"
    | "Building2"
    | "Users"
    | "Handshake"
    | "FolderKanban"
    | "CreditCard"
    | "CheckSquare"
    | "UserCog"
    | "Plug";
};

export const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/dashboard", label: "Dashboard", section: "dashboard", icon: "Home" },
  {
    href: "/dashboard/companies",
    label: "Companies",
    section: "companies",
    icon: "Building2",
  },
  {
    href: "/dashboard/contacts",
    label: "Contacts",
    section: "contacts",
    icon: "Users",
  },
  {
    href: "/dashboard/deals",
    label: "Deals",
    section: "deals",
    icon: "Handshake",
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    section: "projects",
    icon: "FolderKanban",
  },
  {
    href: "/dashboard/payments",
    label: "Payments",
    section: "payments",
    icon: "CreditCard",
  },
  {
    href: "/dashboard/tasks",
    label: "Tasks",
    section: "tasks",
    icon: "CheckSquare",
  },
  // Admin-only — sidebar hides for everyone else via canAccess().
  {
    href: "/dashboard/users",
    label: "Users",
    section: "users",
    icon: "UserCog",
  },
  {
    href: "/dashboard/integrations",
    label: "Integrations",
    section: "integrations",
    icon: "Plug",
  },
];
