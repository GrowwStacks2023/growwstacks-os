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
// Per the Task 25 matrix:
//   - developer: only Dashboard + Tasks in the sidebar; Projects visible
//     in code (so a deep-link to a project they're on the team of works)
//     but hidden from sidebar nav.
//   - sales: no Payments (matrix tightens this — sales no longer reads
//     payments per the new policy).
export const SECTION_ROLES: Record<Section, ReadonlyArray<Role>> = {
  dashboard: ["admin", "sales", "pm", "developer"],
  companies: ["admin", "sales", "pm"],
  contacts: ["admin", "sales", "pm"],
  deals: ["admin", "sales", "pm"],
  projects: ["admin", "sales", "pm", "developer"],
  tasks: ["admin", "sales", "pm", "developer"],
  // Sales no longer included — matrix scopes payments to admin/pm only.
  payments: ["admin", "pm"],
  // Admin surfaces — invite users, manage API keys for external integrations.
  users: ["admin"],
  integrations: ["admin"],
  portal: ["client"],
};

// Sidebar can be tighter than route access. Developer can REACH
// /dashboard/projects via a direct link (to see a project they're on
// the team of), but the sidebar entry is hidden — their daily workflow
// is the Tasks list. Same for Companies/Contacts/Deals/Payments for
// developer.
const SIDEBAR_OVERRIDE: Partial<Record<Section, ReadonlyArray<Role>>> = {
  companies: ["admin", "sales", "pm"],
  contacts: ["admin", "sales", "pm"],
  deals: ["admin", "sales", "pm"],
  // developer DOES have access to /projects (their assigned ones), but
  // we leave them out of the sidebar since most days they live in /tasks.
  projects: ["admin", "sales", "pm"],
  payments: ["admin", "pm"],
};

// Primary gate used by the per-route layouts (to redirect unauthorized
// users away). A null role is never allowed — unauthenticated callers
// should already have been bounced by the dashboard layout.
export function canAccess(role: Role | null, section: Section): boolean {
  if (!role) return false;
  return (SECTION_ROLES[section] as ReadonlyArray<string>).includes(role);
}

// Sidebar-only gate. Falls back to canAccess for sections without an
// override. The sidebar may be MORE restrictive than canAccess (a
// developer can deep-link to /projects but won't see it in the nav).
export function canShowInSidebar(
  role: Role | null,
  section: Section
): boolean {
  if (!role) return false;
  const override = SIDEBAR_OVERRIDE[section];
  if (override) {
    return (override as ReadonlyArray<string>).includes(role);
  }
  return canAccess(role, section);
}

// ─── Entity matrix ─────────────────────────────────────────────────────
// One source of truth for "what can role X do to entity Y". Server
// actions, UI buttons, and (eventually) RLS policies all read from
// these.
//
// Note: developer special cases (edit own task, attachments on assigned
// tasks, view projects via team membership) are NOT encoded here —
// they require runtime DB lookups. See access-server.ts for those.

export type Entity =
  | "company"
  | "contact"
  | "deal"
  | "project"
  | "milestone"
  | "task"
  | "payment"
  | "attachment"
  | "user"
  | "apikey";

export function canCreate(role: Role | null, entity: Entity): boolean {
  if (!role) return false;
  switch (entity) {
    case "company":
      return role === "admin" || role === "pm";
    case "contact":
    case "deal":
      return role === "admin" || role === "pm" || role === "sales";
    case "project":
    case "milestone":
    case "task":
    case "payment":
      return role === "admin" || role === "pm";
    case "attachment":
      // Sales + dev limited by entity-level access checked downstream;
      // admin/pm always allowed. Returning true here for sales/dev means
      // they get past the "can I touch an attachment at all" gate; the
      // detail page hides the upload form for sales on entities they
      // can't write.
      return (
        role === "admin" ||
        role === "pm" ||
        role === "sales" ||
        role === "developer"
      );
    case "user":
    case "apikey":
      return role === "admin";
  }
}

export function canEdit(role: Role | null, entity: Entity): boolean {
  if (!role) return false;
  switch (entity) {
    case "company":
    case "contact":
      return role === "admin" || role === "pm" || role === "sales";
    case "deal":
    case "project":
    case "milestone":
    case "task":
    case "payment":
      return role === "admin" || role === "pm";
    case "attachment":
      // Attachments are immutable in v1 — only the uploader (or admin)
      // can delete. No "edit attachment" beyond that.
      return role === "admin";
    case "user":
    case "apikey":
      return role === "admin";
  }
}

export function canDelete(role: Role | null, entity: Entity): boolean {
  if (!role) return false;
  // Delete is admin-or-pm-only for everything in this matrix except
  // attachments (uploader can delete their own — checked downstream).
  switch (entity) {
    case "company":
    case "contact":
    case "deal":
    case "project":
    case "milestone":
    case "task":
    case "payment":
      return role === "admin" || role === "pm";
    case "attachment":
      return role === "admin";
    case "user":
    case "apikey":
      return role === "admin";
  }
}

// Developer special case for tasks. A developer can update STATUS on
// their assigned tasks (and add attachments — covered by the
// attachment rules). They can't change title, due date, assignee, etc.
// The full set of fields they're allowed to touch is intentionally
// narrow.
export function canEditOwnTask(role: Role | null): boolean {
  return role === "developer";
}

// Sales/PM/admin/dev all view tasks; the "which tasks" scoping happens
// at the query layer. This helper exists so server actions can
// short-circuit before hitting the DB.
export function canViewTaskList(role: Role | null): boolean {
  if (!role) return false;
  return role !== "client";
}

// Attachments are polymorphic across six entity buckets. The matrix
// allows sales to attach to sales-side entities (company/contact/deal)
// and developers to attach to delivery-side entities they can reach
// (project/milestone/task). Admin and PM can attach to anything.
//
// Read access is broader (anyone authenticated can read the rows that
// pass RLS) — this gate is for WRITES (upload / record-link / delete).
export type AttachmentEntity =
  | "company"
  | "contact"
  | "deal"
  | "project"
  | "milestone"
  | "task";

const SALES_ATTACHABLE: ReadonlyArray<AttachmentEntity> = [
  "company",
  "contact",
  "deal",
];
const DELIVERY_ATTACHABLE: ReadonlyArray<AttachmentEntity> = [
  "project",
  "milestone",
  "task",
];

export function canWriteAttachment(
  role: Role | null,
  entityType: AttachmentEntity
): boolean {
  if (!role) return false;
  if (role === "admin" || role === "pm") return true;
  if (role === "sales") {
    return (SALES_ATTACHABLE as ReadonlyArray<string>).includes(entityType);
  }
  if (role === "developer") {
    // Project/milestone/task only. The deeper "team membership or
    // assignment" check happens via RLS on the attachments table after
    // Phase 5 — this gate is the application-layer pre-filter.
    return (DELIVERY_ATTACHABLE as ReadonlyArray<string>).includes(
      entityType
    );
  }
  return false;
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
