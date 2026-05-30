// Shared helpers for writing activity_log rows from server actions.
//
// activity_log has free-form `action` and `entity_type` strings plus
// `before_state` / `after_state` JSON snapshots. The columns are
// purposefully loose so we don't need a migration every time a new
// action verb shows up.
//
// We use:
//   action       = "updated" (matches the existing "created" / "deleted")
//   entity_type  = "company" | "contact" | "deal" | "project" | "milestone"
//                | "task" | "payment"  (mirrors what create/delete write)
//   before_state = the *changed-field* subset of the pre-edit row
//   after_state  = the *changed-field* subset of the post-edit row
//
// Recording only the changed fields (rather than the full row twice) is
// the cheap-write rule from the task brief — finance/compliance queries
// don't care that an unchanged `created_at` was carried across the edit.
//
// diffPayload(before, after, keys)
//   Walk a fixed list of editable keys; produce a {before, after}
//   pair containing only keys whose values differ. Top-level strict
//   equality — fine for the current scalar columns. If a jsonb column
//   ever joins this set, switch to deep equality at that point rather
//   than designing for hypotheticals now.
//
// logEntityUpdate(supabase, ...)
//   Insert one activity_log row using those before/after subsets.
//   No-op when the diff is empty. Best-effort: matches the existing
//   .then(() => undefined, () => undefined) pattern used across delete
//   actions so a log-write failure never breaks the user-facing flow.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

type Row = Record<string, unknown>;

export type EntityDiff<T extends Row> = {
  before: Partial<T>;
  after: Partial<T>;
  // Convenience flag for the "nothing actually changed" short-circuit.
  empty: boolean;
};

export function diffPayload<T extends Row>(
  before: T,
  after: Partial<T>,
  keys: ReadonlyArray<keyof T>
): EntityDiff<T> {
  const beforeOut: Partial<T> = {};
  const afterOut: Partial<T> = {};
  let changed = 0;
  for (const key of keys) {
    if (!(key in after)) continue;
    const fromValue = before[key] as unknown;
    const toValue = after[key] as unknown;
    if (fromValue === toValue) continue;
    beforeOut[key] = fromValue as T[typeof key];
    afterOut[key] = toValue as T[typeof key];
    changed += 1;
  }
  return { before: beforeOut, after: afterOut, empty: changed === 0 };
}

type LogUpdateInput<T extends Row> = {
  entityType:
    | "company"
    | "contact"
    | "deal"
    | "project"
    | "milestone"
    | "task"
    | "payment";
  entityId: string;
  actorId: string | null;
  diff: EntityDiff<T>;
};

export async function logEntityUpdate<T extends Row>(
  supabase: SupabaseClient<Database>,
  input: LogUpdateInput<T>
): Promise<void> {
  if (input.diff.empty) return;
  await supabase
    .from("activity_log")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: "updated",
      actor_id: input.actorId,
      // Cast to Json: scalar columns we audit only contain string /
      // number / boolean / null, all of which satisfy the Json union.
      // Tighter typing would need a Json-shaped diff input — not worth
      // the friction for an audit-best-effort path.
      before_state: input.diff.before as Json,
      after_state: input.diff.after as Json,
    })
    .then(() => undefined, () => undefined);
}
