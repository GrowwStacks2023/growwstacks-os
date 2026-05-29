import {
  badRequest,
  dbError,
  isBodyError,
  readJsonBody,
  withRead,
  withWrite,
} from "@/lib/api/handler";

const SELECT_COLS =
  "id, name, description, status, started_at, expected_end_at, actual_end_at, company_id, contact_id, deal_id, pm_id, created_at, updated_at";

const STATUSES = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export const GET = withRead(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) return dbError(error.message);
  return { status: 200, body: { data } };
});

export const POST = withWrite(async ({ supabase }, req) => {
  const body = await readJsonBody<{
    name?: string;
    description?: string | null;
    status?: string;
    company_id?: string;
    contact_id?: string | null;
    deal_id?: string | null;
    pm_id?: string | null;
    started_at?: string | null;
    expected_end_at?: string | null;
  }>(req);
  if (isBodyError(body)) return badRequest(body._bodyError);

  const name = body.name?.trim();
  if (!name) return badRequest("`name` is required.");
  if (!body.company_id) return badRequest("`company_id` is required.");
  const status = body.status ?? "planning";
  if (!(STATUSES as readonly string[]).includes(status)) {
    return badRequest(`\`status\` must be one of: ${STATUSES.join(", ")}.`);
  }

  const { data: c } = await supabase
    .from("companies")
    .select("id")
    .eq("id", body.company_id)
    .maybeSingle();
  if (!c) return badRequest("`company_id` does not refer to a company.");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: body.description ?? null,
      status: status as (typeof STATUSES)[number],
      company_id: body.company_id,
      contact_id: body.contact_id ?? null,
      deal_id: body.deal_id ?? null,
      pm_id: body.pm_id ?? null,
      started_at: body.started_at ?? null,
      expected_end_at: body.expected_end_at ?? null,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return dbError(error?.message ?? "Insert failed.");
  return { status: 201, body: { data } };
});
