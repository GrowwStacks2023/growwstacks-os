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

// v3 spec palette — pulled directly from the design tokens in
// src/app/globals.css. Each pill leads with a 6px badge-dot (rendered by
// the Badge primitive), so the className only needs to set background +
// text color. The dot inherits `currentColor`.
const COLOR = {
  // Positive / active / done / received / won
  green: "bg-green-100 text-green-700",
  // New / Qualified / In progress / info
  blue: "bg-blue-100 text-blue-700",
  // Review / Proposal sent
  indigo: "bg-violet-100 text-violet-600",
  purple: "bg-violet-100 text-violet-600",
  // Medium / High / On hold / Expected
  amber: "bg-amber-100 text-amber-600",
  // Blocked / Urgent / Overdue
  red: "bg-red-100 text-red-600",
  // Todo / neutral default
  slate: "bg-[#eef3f8] text-ink-500",
  // Light neutral (source chips, low priority)
  zinc: "bg-[#eef3f8] text-ink-500",
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
  new: { variant: "outline", className: COLOR.blue, label: "New" },
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
