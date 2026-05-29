import { dbError, notFound, withRead } from "@/lib/api/handler";

const SELECT_COLS =
  "id, amount, currency, kind, status, received_at, reference, note, project_id, deal_id, company_id, contact_id, recorded_by, created_at, updated_at";

export const GET = withRead(async ({ supabase }, req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop()!;
  const { data, error } = await supabase
    .from("payments")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error.message);
  if (!data) return notFound("Payment not found.");
  return { status: 200, body: { data } };
});
