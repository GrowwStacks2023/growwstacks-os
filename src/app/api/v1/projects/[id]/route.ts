import { dbError, notFound, withRead } from "@/lib/api/handler";

const SELECT_COLS =
  "id, name, description, status, started_at, expected_end_at, actual_end_at, company_id, contact_id, deal_id, pm_id, created_at, updated_at";

export const GET = withRead(async ({ supabase }, req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop()!;
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error.message);
  if (!data) return notFound("Project not found.");
  return { status: 200, body: { data } };
});
