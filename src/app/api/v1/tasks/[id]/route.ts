import { dbError, notFound, withRead } from "@/lib/api/handler";

const SELECT_COLS =
  "id, title, description, status, priority, due_at, estimate_hours, milestone_id, project_id, deal_id, contact_id, assignee_id, pm_id, created_at, updated_at";

export const GET = withRead(async ({ supabase }, req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop()!;
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error.message);
  if (!data) return notFound("Task not found.");
  return { status: 200, body: { data } };
});
