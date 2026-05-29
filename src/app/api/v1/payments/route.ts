import {
  badRequest,
  dbError,
  isBodyError,
  readJsonBody,
  withRead,
  withWrite,
} from "@/lib/api/handler";

const SELECT_COLS =
  "id, amount, currency, kind, status, received_at, reference, note, project_id, deal_id, company_id, contact_id, recorded_by, created_at, updated_at";

const KINDS = ["advance", "installment", "final", "other"] as const;
const STATUSES = ["expected", "received", "refunded"] as const;
const CURRENCIES = ["INR", "USD"] as const;

export const GET = withRead(async ({ supabase }) => {
  const { data, error } = await supabase
    .from("payments")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) return dbError(error.message);
  return { status: 200, body: { data } };
});

export const POST = withWrite(async ({ supabase }, req) => {
  const body = await readJsonBody<{
    amount?: number;
    currency?: string;
    kind?: string;
    status?: string;
    received_at?: string | null;
    reference?: string | null;
    note?: string | null;
    project_id?: string | null;
    deal_id?: string | null;
  }>(req);
  if (isBodyError(body)) return badRequest(body._bodyError);

  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
    return badRequest("`amount` must be a positive number.");
  }
  if (!body.project_id && !body.deal_id) {
    return badRequest("Provide one of `project_id` or `deal_id`.");
  }
  if (body.project_id && body.deal_id) {
    return badRequest(
      "Provide only one of `project_id` or `deal_id`, not both."
    );
  }
  const currency = body.currency ?? "INR";
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    return badRequest(`\`currency\` must be one of: ${CURRENCIES.join(", ")}.`);
  }
  const kind = body.kind ?? "installment";
  if (!(KINDS as readonly string[]).includes(kind)) {
    return badRequest(`\`kind\` must be one of: ${KINDS.join(", ")}.`);
  }
  const status = body.status ?? "expected";
  if (!(STATUSES as readonly string[]).includes(status)) {
    return badRequest(`\`status\` must be one of: ${STATUSES.join(", ")}.`);
  }

  // Derive company_id (NOT NULL) AND contact_id from the parent. Mirrors
  // the server action in src/components/payments/actions.ts.
  let companyId: string | null = null;
  let contactId: string | null = null;
  if (body.project_id) {
    const { data: p } = await supabase
      .from("projects")
      .select("company_id, contact_id")
      .eq("id", body.project_id)
      .maybeSingle();
    if (!p) return badRequest("`project_id` does not refer to a project.");
    companyId = p.company_id;
    contactId = p.contact_id ?? null;
  } else if (body.deal_id) {
    const { data: d } = await supabase
      .from("deals")
      .select("company_id, contact_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!d) return badRequest("`deal_id` does not refer to a deal.");
    companyId = d.company_id;
    contactId = d.contact_id ?? null;
  }
  if (!companyId) {
    return dbError("Couldn't derive company_id from the parent.");
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      amount: body.amount,
      currency,
      kind,
      status,
      received_at: status === "received" ? body.received_at ?? null : null,
      reference: body.reference ?? null,
      note: body.note ?? null,
      project_id: body.project_id ?? null,
      deal_id: body.deal_id ?? null,
      company_id: companyId,
      contact_id: contactId,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return dbError(error?.message ?? "Insert failed.");
  return { status: 201, body: { data } };
});
