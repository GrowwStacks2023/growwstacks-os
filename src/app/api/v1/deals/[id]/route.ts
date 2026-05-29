import { dbError, notFound, withRead } from "@/lib/api/handler";

const SELECT_COLS =
  "id, title, description, stage, source, value_inr, value_usd, company_id, contact_id, owner_id, created_at, updated_at";

export const GET = withRead(async ({ supabase }, req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop()!;
  const { data, error } = await supabase
    .from("deals")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error.message);
  if (!data) return notFound("Deal not found.");
  return { status: 200, body: { data } };
});
