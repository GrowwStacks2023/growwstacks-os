import type { Database } from "@/types/database";

type ProjectStatus = Database["public"]["Enums"]["project_status"];
type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];
type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];

// Badge component supports: default | secondary | destructive | outline | ghost
type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost";

type StatusVisual = {
  variant: BadgeVariant;
  className?: string;
  label: string;
};

// Tailwind palettes used for finer-grained colour than the 6 built-in variants
// offer. Kept here (not in badge.tsx) so the badge primitive stays stack-agnostic.
const COLOR = {
  slate:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
  amber:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  green:
    "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200",
  red: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200",
  purple:
    "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-200",
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
