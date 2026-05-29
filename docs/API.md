# GrowwStacks OS — Public HTTP API (v1)

The public API exposes the six core entities of the workspace for
integrations like n8n, Postman scripts, automation glue, and ad-hoc
imports. The entire surface is **read + create only** in v1. Update and
delete will come in a later version when we've shaken out the
semantics — for now, modify rows in the dashboard.

> **Auth model:** API keys, not user sessions. Each call is gated by a
> single header. RLS does not apply to these requests because there is
> no `auth.uid()` — the API key and its scope are the **entire**
> authorization boundary. Every request is logged to `api_audit_log`.

## Generating a key

1. Sign in to the dashboard as **admin**.
2. Open **Integrations** in the sidebar → click **Generate key**.
3. Name the key (e.g. `n8n integration`, `Postman testing`) and pick a
   scope:
   - `read` — `GET` only.
   - `read_write` — `GET` + `POST`.
4. **The plaintext key is shown ONCE.** Copy it into your password
   manager / n8n credential store immediately. We store only a SHA-256
   hash of the key plus a short visible prefix (e.g. `gks_a1b2c3d4…`);
   if the plaintext is lost, revoke the key and generate a new one.

## Authentication

Send the key with every request via either header:

```http
Authorization: Bearer gks_<your-key>
```

or:

```http
X-API-Key: gks_<your-key>
```

A missing, invalid, or revoked key returns `401`.

## Scopes

| Scope        | GET | POST |
|--------------|-----|------|
| `read`       | ✓   | ✗ (`403`) |
| `read_write` | ✓   | ✓    |

## Response shapes

Success:

```json
{ "data": { "..." } }
```

Error:

```json
{ "error": "human-readable message", "code": "snake_case_code" }
```

Common error codes:

| Code                | HTTP | Meaning                                        |
|---------------------|------|------------------------------------------------|
| `missing_key`       | 401  | No `Authorization` / `X-API-Key` header sent.  |
| `invalid_key`       | 401  | Header present but no matching active key.     |
| `revoked_key`       | 401  | Key existed but has been revoked.              |
| `insufficient_scope`| 403  | Read-only key tried to POST.                   |
| `bad_request`       | 400  | Missing/invalid body fields.                   |
| `not_found`         | 404  | Detail endpoint, id not found.                 |
| `db_error`          | 500  | Postgres insert/select failure.                |
| `internal_error`    | 500  | Anything else uncaught.                        |

## Endpoints

Base URL: `https://growwstacks-os.vercel.app/api/v1` (or your
deployment). Each entity has a list/create route at the collection and a
read route at `[id]`.

### Companies

```http
GET    /api/v1/companies          # list
GET    /api/v1/companies/:id      # detail
POST   /api/v1/companies          # create (read_write)
```

Body for `POST`:

```json
{
  "name": "Acme Robotics",           // required
  "type": "client",                   // optional, default "prospect"; one of client|prospect|partner
  "timezone": "Asia/Kolkata"          // optional, default "Asia/Kolkata"
}
```

### Contacts

```http
GET    /api/v1/contacts
GET    /api/v1/contacts/:id
POST   /api/v1/contacts
```

Body for `POST`:

```json
{
  "name": "Priya Sharma",             // required
  "email": "priya@acmerobotics.com",  // optional
  "phone": "+91…",                    // optional
  "whatsapp": "+91…",                 // optional
  "role": "Head of Ops",              // optional
  "company_id": "<uuid>",             // optional; if set, must exist
  "is_primary": false                 // optional
}
```

### Deals

```http
GET    /api/v1/deals
GET    /api/v1/deals/:id
POST   /api/v1/deals
```

Body for `POST`:

```json
{
  "title": "Q3 retainer",                       // required
  "description": "Phase 2 of the warehouse rollout", // optional
  "company_id": "<uuid>",                       // required, must exist
  "contact_id": "<uuid>",                       // optional
  "owner_id": "<uuid>",                         // optional
  "stage": "new",                                // default "new"; one of new|qualified|proposal_sent|negotiation|won|lost
  "source": "inbound",                           // default "other"; one of upwork|linkedin|referral|inbound|other
  "value_inr": 250000,                           // optional
  "value_usd": null                              // optional
}
```

### Projects

```http
GET    /api/v1/projects
GET    /api/v1/projects/:id
POST   /api/v1/projects
```

Body for `POST`:

```json
{
  "name": "Acme Customer Portal",     // required
  "company_id": "<uuid>",             // required, must exist
  "contact_id": "<uuid>",             // optional
  "deal_id": "<uuid>",                // optional
  "pm_id": "<uuid>",                  // optional
  "description": "MVP scope…",        // optional
  "status": "planning",               // default "planning"; one of planning|active|on_hold|completed|cancelled
  "started_at": "2026-06-01",         // optional (ISO date)
  "expected_end_at": "2026-09-30"     // optional (ISO date)
}
```

### Tasks

```http
GET    /api/v1/tasks
GET    /api/v1/tasks/:id
POST   /api/v1/tasks
```

Body for `POST`:

```json
{
  "title": "Wire SSO with Okta",           // required
  "description": "…",                       // optional
  "status": "todo",                          // default "todo"; one of todo|in_progress|review|done|blocked
  "priority": "medium",                      // default "medium"; one of low|medium|high|urgent
  "due_at": "2026-07-15T00:00:00Z",          // optional ISO timestamp
  "estimate_hours": 4,                       // optional
  // At least ONE of these three is required (DB constraint):
  "milestone_id": "<uuid>",
  "deal_id": "<uuid>",
  "contact_id": "<uuid>",
  "assignee_id": "<uuid>",                   // optional
  "pm_id": "<uuid>"                          // optional
}
```

If you set `milestone_id`, the API derives `project_id` server-side from
the milestone — you don't need to pass it.

### Payments

```http
GET    /api/v1/payments
GET    /api/v1/payments/:id
POST   /api/v1/payments
```

Body for `POST`:

```json
{
  "amount": 200000,                       // required, positive number
  "currency": "INR",                       // default "INR"; one of INR|USD
  "kind": "installment",                   // default "installment"; one of advance|installment|final|other
  "status": "expected",                    // default "expected"; one of expected|received|refunded
  // Exactly ONE of these two is required:
  "project_id": "<uuid>",
  "deal_id": "<uuid>",
  "received_at": "2026-06-15T00:00:00Z",   // only used when status="received"
  "reference": "INV-204",                  // optional
  "note": "Tranche 1 of 3"                 // optional
}
```

`company_id` and `contact_id` are derived server-side from the chosen
project or deal — don't pass them.

## Curl examples

List companies:

```bash
curl -sS https://growwstacks-os.vercel.app/api/v1/companies \
  -H "Authorization: Bearer $GKS_KEY"
```

Read a single deal:

```bash
curl -sS https://growwstacks-os.vercel.app/api/v1/deals/33333333-3333-… \
  -H "X-API-Key: $GKS_KEY"
```

Create a contact (requires `read_write`):

```bash
curl -sS -X POST https://growwstacks-os.vercel.app/api/v1/contacts \
  -H "Authorization: Bearer $GKS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Sharma",
    "email": "priya@acmerobotics.com",
    "company_id": "11111111-1111-…"
  }'
```

Expected response for a write attempt with a read-only key:

```json
{
  "error": "This key has read scope; POST requires read_write.",
  "code": "insufficient_scope"
}
```
HTTP `403`.

## Audit log

Every request — successful or not — is logged to `api_audit_log` with
the key id (when known), method, path, response status, IP, and user
agent. Admins can read this table via Supabase Studio for now. A
dashboard view is a later addition.

## Rate limits

**None in v1.** Flagged for follow-up: per-key rate limiting is best
added at the edge (Cloudflare / Vercel rules) rather than inside the
route handler. Until then, treat the API as best-effort — bursty clients
that abuse it will get throttled at the platform layer.

## Security warnings

- **Never commit keys** to git. Use a secret manager (Vercel env vars,
  n8n credentials, GitHub Actions secrets) or your password manager.
- **Rotate keys** when a teammate leaves or a credential might have
  leaked. Revoke the old key from **Integrations** before generating a
  new one.
- **Revoke unused keys.** Every active key is an attack surface; if you
  don't recognise one in the integrations list, revoke it.
- **Use the smallest scope** that works. Read-only keys for dashboards,
  read+write only when an integration actually needs to create rows.
- Keys are SHA-256-hashed at rest. Plaintext is shown once on
  generation and then forgotten — there is no recovery, only revoke +
  regenerate.
