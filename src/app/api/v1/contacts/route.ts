import {
  badRequest,
  dbError,
  isBodyError,
  readJsonBody,
  withRead,
  withWrite,
} from "@/lib/api/handler";

const SELECT_COLS =
  "id, name, email, phone, whatsapp, role, is_primary, company_id, created_at, updated_at";

export const GET = withRead(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("contacts")
    .select(SELECT_COLS)
    .order("name", { ascending: true });
  if (error) return dbError(error.message);
  return { status: 200, body: { data } };
});

export const POST = withWrite(async ({ supabase }, req) => {
  const body = await readJsonBody<{
    name?: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    role?: string | null;
    company_id?: string | null;
    is_primary?: boolean;
  }>(req);
  if (isBodyError(body)) return badRequest(body._bodyError);
  const name = body.name?.trim();
  if (!name) return badRequest("`name` is required.");

  if (body.company_id) {
    // Verify the FK exists so we return 400 instead of leaking a Postgres
    // 23503 message.
    const { data: c } = await supabase
      .from("companies")
      .select("id")
      .eq("id", body.company_id)
      .maybeSingle();
    if (!c) return badRequest("`company_id` does not refer to a company.");
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      whatsapp: body.whatsapp ?? null,
      role: body.role ?? null,
      company_id: body.company_id ?? null,
      is_primary: body.is_primary ?? false,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return dbError(error?.message ?? "Insert failed.");
  return { status: 201, body: { data } };
});
