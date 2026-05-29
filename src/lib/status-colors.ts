import type { Database } from "@/types/database";

type ProjectStatus = Database["public"]["Enums"]["project_status"];
type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];
type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];
type DealStage = Database["public"]["Enums"]["deal_stage"];
type DealSource = Database["public"]["Enums"]["deal_source"];

// Badge component supports: default | secondary | destructive | outline | ghost
type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost";

type StatusVisual = {
  variant: BadgeVariant;
  className?: string;
  label: string;
};

// Tailwind palettes used for finer-grained colour than the 6 built-in variants
// offer. Kept here (not in badge.tsx) so the badge primitive stays stack-agnostic.
//
// Identity v2 uses a cool blue/white palette, so neutrals go back to `slate`
// (cool grey) to read as part of the same family. Semantic colors stay
// universal: green for done/received/won, amber for in-flight/expected,
// red for blocked/lost. Subtle ring + dark-mode treatments make the chips
// feel intentional rather than rectangular fills.
const COLOR = {
  slate:
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/60 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/20",
  blue:
    "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-500/20 dark:text-blue-200 dark:ring-blue-400/20",
  indigo:
    "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/20 dark:text-indigo-200 dark:ring-indigo-400/20",
  amber:
    "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/20",
  green:
    "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/20",
  red:
    "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200/70 dark:bg-red-500/20 dark:text-red-200 dark:ring-red-400/20",
  purple:
    "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200/70 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/20",
  zinc:
    "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/50 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/15",
} as const;

export const PROJECT_STATUS: Record<ProjectStatus, StatusVisual> = {
  planning: { variant: "outline", className: COLOR.slate, label: "Planning" },
  active: { variant: "outline", className: COLOR.blue, label: "Active" },
  on_hold: { variant: "outline", className: COLOR.amber, label: "On hold" },
  completed: { variant: "outline", className: COLOR.green, label: "Completed" },
  cancelled: { variant: "outline", className: COLOR.zinc, label: "Cancelled" },
};

export const MILESTONE_STATUS: Record<MilestoneStatus, StatusVisual> = {
  not_started: {
    variant: "outline",
    className: COLOR.slate,
    label: "Not started",
  },
  in_progress: {
    variant: "outline",
    className: COLOR.blue,
    label: "In progress",
  },
  completed: { variant: "outline", className: COLOR.green, label: "Completed" },
  blocked: { variant: "outline", className: COLOR.red, label: "Blocked" },
};

export const TASK_STATUS: Record<TaskStatus, StatusVisual> = {
  todo: { variant: "outline", className: COLOR.slate, label: "Todo" },
  in_progress: {
    variant: "outline",
    className: COLOR.blue,
    label: "In progress",
  },
  review: { variant: "outline", className: COLOR.purple, label: "Review" },
  done: { variant: "outline", className: COLOR.green, label: "Done" },
  blocked: { variant: "outline", className: COLOR.red, label: "Blocked" },
};

export const TASK_PRIORITY: Record<TaskPriority, StatusVisual> = {
  low: { variant: "outline", className: COLOR.zinc, label: "Low" },
  medium: { variant: "outline", className: COLOR.slate, label: "Medium" },
  high: { variant: "outline", className: COLOR.amber, label: "High" },
  urgent: { variant: "outline", className: COLOR.red, label: "Urgent" },
};

// Pipeline ordering: matches the natural left-to-right flow on the deals page.
export const DEAL_STAGE_ORDER: readonly DealStage[] = [
  "new",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;

export const DEAL_STAGE: Record<DealStage, StatusVisual> = {
  new: { variant: "outline", className: COLOR.slate, label: "New" },
  qualified: { variant: "outline", className: COLOR.blue, label: "Qualified" },
  proposal_sent: {
    variant: "outline",
    className: COLOR.indigo,
    label: "Proposal sent",
  },
  negotiation: {
    variant: "outline",
    className: COLOR.amber,
    label: "Negotiation",
  },
  won: { variant: "outline", className: COLOR.green, label: "Won" },
  lost: { variant: "outline", className: COLOR.red, label: "Lost" },
};

export const DEAL_SOURCE: Record<DealSource, StatusVisual> = {
  upwork: { variant: "outline", className: COLOR.zinc, label: "Upwork" },
  linkedin: { variant: "outline", className: COLOR.zinc, label: "LinkedIn" },
  referral: { variant: "outline", className: COLOR.zinc, label: "Referral" },
  inbound: { variant: "outline", className: COLOR.zinc, label: "Inbound" },
  other: { variant: "outline", className: COLOR.zinc, label: "Other" },
};

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS).map(
  ([value, v]) => ({ value: value as ProjectStatus, label: v.label })
);
export const MILESTONE_STATUS_OPTIONS = Object.entries(MILESTONE_STATUS).map(
  ([value, v]) => ({ value: value as MilestoneStatus, label: v.label })
);
export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS).map(
  ([value, v]) => ({ value: value as TaskStatus, label: v.label })
);
export const TASK_PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY).map(
  ([value, v]) => ({ value: value as TaskPriority, label: v.label })
);
export const DEAL_STAGE_OPTIONS = DEAL_STAGE_ORDER.map((value) => ({
  value,
  label: DEAL_STAGE[value].label,
}));
export const DEAL_SOURCE_OPTIONS = Object.entries(DEAL_SOURCE).map(
  ([value, v]) => ({ value: value as DealSource, label: v.label })
);

// Payments — kind/status come from CHECK constraints in 0012_payments.sql,
// not Postgres enums (currency list will grow when GBP/AED engagements land
// and we don't want a migration for that). Keep the unions in sync with
// the migration if either list changes.
export type PaymentKind = "advance" | "installment" | "final" | "other";
export type PaymentStatus = "expected" | "received" | "refunded";

export const PAYMENT_KIND: Record<PaymentKind, StatusVisual> = {
  advance: { variant: "outline", className: COLOR.indigo, label: "Advance" },
  installment: {
    variant: "outline",
    className: COLOR.blue,
    label: "Installment",
  },
  final: { variant: "outline", className: COLOR.green, label: "Final" },
  other: { variant: "outline", className: COLOR.zinc, label: "Other" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusVisual> = {
  expected: { variant: "outline", className: COLOR.amber, label: "Expected" },
  received: { variant: "outline", className: COLOR.green, label: "Received" },
  refunded: { variant: "outline", className: COLOR.red, label: "Refunded" },
};

export const PAYMENT_KIND_OPTIONS = (
  Object.entries(PAYMENT_KIND) as [PaymentKind, StatusVisual][]
).map(([value, v]) => ({ value, label: v.label }));

export const PAYMENT_STATUS_OPTIONS = (
  Object.entries(PAYMENT_STATUS) as [PaymentStatus, StatusVisual][]
).map(([value, v]) => ({ value, label: v.label }));
