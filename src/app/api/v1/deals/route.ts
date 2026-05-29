import {
  badRequest,
  dbError,
  isBodyError,
  readJsonBody,
  withRead,
  withWrite,
} from "@/lib/api/handler";

const SELECT_COLS =
  "id, title, description, stage, source, value_inr, value_usd, company_id, contact_id, owner_id, created_at, updated_at";

const STAGES = [
  "new",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;
const SOURCES = ["upwork", "linkedin", "referral", "inbound", "other"] as const;

export const GET = withRead(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("deals")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) return dbError(error.message);
  return { status: 200, body: { data } };
});

export const POST = withWrite(async ({ supabase }, req) => {
  const body = await readJsonBody<{
    title?: string;
    description?: string | null;
    stage?: string;
    source?: string;
    value_inr?: number | null;
    value_usd?: number | null;
    company_id?: string;
    contact_id?: string | null;
    owner_id?: string | null;
  }>(req);
  if (isBodyError(body)) return badRequest(body._bodyError);

  const title = body.title?.trim();
  if (!title) return badRequest("`title` is required.");
  if (!body.company_id) return badRequest("`company_id` is required.");

  const stage = body.stage ?? "new";
  if (!(STAGES as readonly string[]).includes(stage)) {
    return badRequest(`\`stage\` must be one of: ${STAGES.join(", ")}.`);
  }
  const source = body.source ?? "other";
  if (!(SOURCES as readonly string[]).includes(source)) {
    return badRequest(`\`source\` must be one of: ${SOURCES.join(", ")}.`);
  }

  const { data: c } = await supabase
    .from("companies")
    .select("id")
    .eq("id", body.company_id)
    .maybeSingle();
  if (!c) return badRequest("`company_id` does not refer to a company.");

  const { data, error } = await supabase
    .from("deals")
    .insert({
      title,
      description: body.description ?? null,
      stage: stage as (typeof STAGES)[number],
      source: source as (typeof SOURCES)[number],
      value_inr: body.value_inr ?? null,
      value_usd: body.value_usd ?? null,
      company_id: body.company_id,
      contact_id: body.contact_id ?? null,
      owner_id: body.owner_id ?? null,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return dbError(error?.message ?? "Insert failed.");
  return { status: 201, body: { data } };
});
