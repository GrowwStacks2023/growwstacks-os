import {
  badRequest,
  dbError,
  isBodyError,
  readJsonBody,
  withRead,
  withWrite,
} from "@/lib/api/handler";

const SELECT_COLS =
  "id, title, description, status, priority, due_at, estimate_hours, milestone_id, project_id, deal_id, contact_id, assignee_id, pm_id, created_at, updated_at";

const STATUSES = ["todo", "in_progress", "review", "done", "blocked"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const GET = withRead(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) return dbError(error.message);
  return { status: 200, body: { data } };
});

export const POST = withWrite(async ({ supabase }, req) => {
  const body = await readJsonBody<{
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    due_at?: string | null;
    estimate_hours?: number | null;
    milestone_id?: string | null;
    project_id?: string | null;
    deal_id?: string | null;
    contact_id?: string | null;
    assignee_id?: string | null;
    pm_id?: string | null;
  }>(req);
  if (isBodyError(body)) return badRequest(body._bodyError);

  const title = body.title?.trim();
  if (!title) return badRequest("`title` is required.");

  // tasks CHECK constraint (0011) requires at least one context. Surface
  // a clear 400 instead of leaking the Postgres constraint message.
  if (!body.milestone_id && !body.deal_id && !body.contact_id) {
    return badRequest(
      "At least one of `milestone_id`, `deal_id`, or `contact_id` is required."
    );
  }

  const status = body.status ?? "todo";
  if (!(STATUSES as readonly string[]).includes(status)) {
    return badRequest(`\`status\` must be one of: ${STATUSES.join(", ")}.`);
  }
  const priority = body.priority ?? "medium";
  if (!(PRIORITIES as readonly string[]).includes(priority)) {
    return badRequest(`\`priority\` must be one of: ${PRIORITIES.join(", ")}.`);
  }

  // If milestone_id given, derive project_id so the consistency trigger
  // doesn't bounce us.
  let projectId: string | null = body.project_id ?? null;
  if (body.milestone_id) {
    const { data: m } = await supabase
      .from("milestones")
      .select("project_id")
      .eq("id", body.milestone_id)
      .maybeSingle();
    if (!m) {
      return badRequest("`milestone_id` does not refer to a milestone.");
    }
    projectId = m.project_id;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: body.description ?? null,
      status: status as (typeof STATUSES)[number],
      priority: priority as (typeof PRIORITIES)[number],
      due_at: body.due_at ?? null,
      estimate_hours: body.estimate_hours ?? null,
      milestone_id: body.milestone_id ?? null,
      project_id: projectId,
      deal_id: body.deal_id ?? null,
      contact_id: body.contact_id ?? null,
      assignee_id: body.assignee_id ?? null,
      pm_id: body.pm_id ?? null,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return dbError(error?.message ?? "Insert failed.");
  return { status: 201, body: { data } };
});
