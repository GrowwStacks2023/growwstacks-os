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
// Task 26 corrected matrix:
//   - PM: NO access to Deals at all. PMs handle delivery only.
//   - Developer: Projects visible (team-member-only data via the
//     project_team_members table, see Phase B / 0020).
//   - Sales: no Payments.
export const SECTION_ROLES: Record<Section, ReadonlyArray<Role>> = {
  dashboard: ["admin", "sales", "pm", "developer"],
  companies: ["admin", "sales", "pm"],
  contacts: ["admin", "sales", "pm"],
  // Deals: admin + sales only. PM removed per corrected matrix.
  deals: ["admin", "sales"],
  projects: ["admin", "sales", "pm", "developer"],
  tasks: ["admin", "sales", "pm", "developer"],
  payments: ["admin", "pm"],
  users: ["admin"],
  integrations: ["admin"],
  portal: ["client"],
};

// Sidebar can be tighter than route access. After Task 26:
//   developer sees Dashboard + Projects + Tasks. Companies/Contacts/
//   Deals/Payments stay hidden for them.
//   pm explicitly hides Deals (matrix says PM has no deals access).
//   sales hides Payments.
const SIDEBAR_OVERRIDE: Partial<Record<Section, ReadonlyArray<Role>>> = {
  companies: ["admin", "sales", "pm"],
  contacts: ["admin", "sales", "pm"],
  // Deals: PM never sees deals nav (matches SECTION_ROLES).
  deals: ["admin", "sales"],
  // Projects: developer DOES see this in the sidebar now per the
  // corrected matrix. Page-level filtering by team-membership is in
  // Phase B + RLS (Phase C).
  projects: ["admin", "sales", "pm", "developer"],
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

// Task 26 corrected matrix:
//   company  create: admin, pm                edit/delete: admin, pm
//   contact  create: admin, pm, sales         edit: admin, pm, sales   delete: admin, pm
//   deal     create: admin, sales             edit: admin, sales       delete: admin
//   project  create: admin, pm                edit/delete: admin, pm
//   milestone create: admin, pm               edit/delete: admin, pm
//   task     create: admin, pm                edit: admin, pm (own-task: developer via canEditOwnTaskOnly)  delete: admin, pm
//   payment  create: admin, pm                edit/delete: admin, pm
//   user     create/edit/delete: admin only
//   apikey   admin only
//   attachment write: admin, pm anywhere; sales on company/contact/deal;
//             developer on project/milestone/task they can access
//             (the entity-scope check happens downstream via RLS).
export function canCreate(role: Role | null, entity: Entity): boolean {
  if (!role) return false;
  switch (entity) {
    case "company":
      return role === "admin" || role === "pm";
    case "contact":
      return role === "admin" || role === "pm" || role === "sales";
    case "deal":
      // PM has no deals access at all per corrected matrix.
      return role === "admin" || role === "sales";
    case "project":
    case "milestone":
    case "task":
    case "payment":
      return role === "admin" || role === "pm";
    case "attachment":
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
      return role === "admin" || role === "pm";
    case "contact":
      return role === "admin" || role === "pm" || role === "sales";
    case "deal":
      // Sales can edit ANY deal (matches matrix). PM blocked.
      return role === "admin" || role === "sales";
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

export function canDelete(role: Role | null, entity: Entity): boolean {
  if (!role) return false;
  switch (entity) {
    case "company":
    case "contact":
    case "project":
    case "milestone":
    case "task":
    case "payment":
      return role === "admin" || role === "pm";
    case "deal":
      // Deals delete: admin only per corrected matrix.
      return role === "admin";
    case "attachment":
      return role === "admin";
    case "user":
    case "apikey":
      return role === "admin";
  }
}

// Developer-only task editing. Combined with assignee_id check downstream
// (the action verifies the task is assigned to the caller) AND a narrow
// field whitelist (status + attachments only), this is the developer's
// total edit surface.
export function canEditOwnTaskOnly(role: Role | null): boolean {
  return role === "developer";
}

// Strict deal viewability — PM is excluded per corrected matrix.
export function canViewDeals(role: Role | null): boolean {
  return role === "admin" || role === "sales";
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
