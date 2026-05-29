import {
  badRequest,
  dbError,
  isBodyError,
  readJsonBody,
  withRead,
  withWrite,
} from "@/lib/api/handler";

const COMPANY_TYPES = ["client", "prospect", "partner"] as const;

// GET /api/v1/companies — list all visible companies.
export const GET = withRead(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, type, timezone, business_hours_start, business_hours_end, created_at, updated_at")
    .order("name", { ascending: true });
  if (error) return dbError(error.message);
  return { status: 200, body: { data } };
});

// POST /api/v1/companies — create.
export const POST = withWrite(async ({ supabase }, req) => {
  const body = await readJsonBody<{
    name?: string;
    type?: string;
    timezone?: string;
  }>(req);
  if (isBodyError(body)) return badRequest(body._bodyError);

  const name = body.name?.trim();
  if (!name) return badRequest("`name` is required.");
  const type = body.type ?? "prospect";
  if (!(COMPANY_TYPES as readonly string[]).includes(type)) {
    return badRequest("`type` must be one of: client, prospect, partner.");
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      type: type as (typeof COMPANY_TYPES)[number],
      timezone: body.timezone ?? "Asia/Kolkata",
    })
    .select(
      "id, name, type, timezone, business_hours_start, business_hours_end, created_at, updated_at"
    )
    .single();
  if (error || !data) return dbError(error?.message ?? "Insert failed.");
  return { status: 201, body: { data } };
});
