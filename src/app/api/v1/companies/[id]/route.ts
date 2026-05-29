import { dbError, notFound, withRead } from "@/lib/api/handler";

// GET /api/v1/companies/:id
export const GET = withRead(async ({ supabase }, req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop()!;
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, type, timezone, business_hours_start, business_hours_end, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error.message);
  if (!data) return notFound("Company not found.");
  return { status: 200, body: { data } };
});
