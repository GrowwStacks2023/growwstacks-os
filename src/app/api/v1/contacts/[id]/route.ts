import { dbError, notFound, withRead } from "@/lib/api/handler";

const SELECT_COLS =
  "id, name, email, phone, whatsapp, role, is_primary, company_id, created_at, updated_at";

export const GET = withRead(async ({ supabase }, req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop()!;
  const { data, error } = await supabase
    .from("contacts")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error.message);
  if (!data) return notFound("Contact not found.");
  return { status: 200, body: { data } };
});
