@AGENTS.md

# GROWWSTACKS OS — PROJECT CONTEXT v1

## WHAT WE'RE BUILDING

An internal CRM + project management system for GrowwStacks (an AI/automation agency). It replaces the current scattered Airtable + GHL + HubSpot setup with one source of truth. Serves 40–45 internal team members. Two surfaces (sales + delivery) sharing one schema. An AI layer watches client communications and flags unanswered messages.

## PRINCIPLE THAT OVERRIDES EVERYTHING

**"Reduce PM burden, don't add to it."** Every feature gets measured against this. If a feature creates more notifications than value, it doesn't ship.

## STACK (LOCKED — do not propose alternatives)

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js Server Actions + API routes (same project, no separate backend)
- **Database**: Supabase (Postgres 15 + pgvector + RLS + Auth + Storage)
- **Deployment**: Cloudflare Pages via `@opennextjs/cloudflare` adapter
- **Integrations**: n8n on Hostinger VPS (already running) for external data ingestion
- **AI**: Anthropic Claude API for reasoning, OpenAI `text-embedding-3-small` for vectors

## REPO

- GitHub: `GrowwStacks2023/growwstacks-os`
- Current state: empty except for `.gitignore` and `.mcp.json` (which is gitignored)

## V1 SCOPE — 12 TABLES

1. `companies` (clients + prospects, has `business_hours`, `timezone`)
2. `contacts` (people at companies)
3. `users` (extends `auth.users` with role enum: `admin/sales/pm/developer/client`)
4. `deals` (sales pipeline, sourced from Upwork/LinkedIn/etc.)
5. `projects` (won deals become projects, has `pm_id`)
6. `milestones` (phases within a project, has `sequence` number)
7. `tasks` (work units within milestones — every task belongs to a milestone via `milestone_id`, no orphan tasks)
8. `communications` (unified inbound/outbound across outlook/whatsapp/upwork/slack/email/sms with `direction`, `thread_id`, `requires_reply`, `reply_due_at`, `sla_state`)
9. `credentials` (encrypted client logins — CMS, hosting, social media)
10. `credential_access_log` (audit trail for credential reads)
11. `activity_log` (append-only audit of who did what)
12. `sla_rules` (per-company SLA configuration)
13. `sla_breaches` (AI-detected unanswered messages — separate from `sla_rules`)

## CRITICAL HIERARCHY

`project → milestones[] → tasks[]`

Every task has `milestone_id` (NOT NULL). No tasks attached directly to projects without a milestone.

## V1 AI SCOPE — ONE AGENT ONLY

**Capacity detection.** Nightly cron computes per-user load (committed hours, logged hours, overdue tasks), Claude API reasons over it, writes structured output to `capacity_snapshots` table.

## NOT IN V1 (deferred to v2/v3)

- Tone/sentiment analysis on comms (v2)
- SLA escalation actions (v3)
- Risk scoring (v3)
- Client portal (deferred)
- Vector embeddings (v2 — schema designed for it, pipeline built later)

## ROLE-BASED ACCESS (via Postgres RLS)

- **admin**: sees everything
- **sales**: companies, contacts, deals, communications — but only summary access to projects
- **pm**: full delivery side + project-related sales context
- **developer**: only projects/tasks/communications for projects they're assigned to
- **client**: reserved for v2 client portal, not active in v1

## SECURITY RULES (NON-NEGOTIABLE)

- RLS enabled on every table, no exceptions
- `credentials` table: `encrypted_value` column, encrypted at app layer (NOT just Postgres TDE), key stored in Cloudflare secrets
- Every credential read logs to `credential_access_log`
- Service role key NEVER exposed to the client (no `NEXT_PUBLIC_` usage)
- Never commit `.env.local`, `.mcp.json`, or any secret to Git

## DEPLOYMENT TARGET

- App URL TBD (likely `os.growwstacks.com` or `app.growwstacks.com`)
- Cloudflare Pages with `@opennextjs/cloudflare` adapter

## HOW WE WORK

- Raghav is the developer. New to Next.js, comfortable with React.
- The architecture above was decided between Manish (founder) and Claude before Raghav joined.
- These decisions are **LOCKED**. If anything seems wrong, Raghav flags it to Manish for discussion. **Default behavior: build the plan.**
- Claude Code is the pair programmer. Explain what you're doing when you do it. Raghav learns by reading the code you generate.
- Pace: he'd rather understand each step than ship fast and not know what's happening.
