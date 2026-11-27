# Demo runbook

Use this to set up and run the 5-minute prototype demo. Everything shown must be
synthetic. Say "this screen is a mock-up" whenever a screen is not backed by the
API. Real vs mocked vs roadmap is listed at the end.

## 1. Reset and seed

```bash
corepack enable
pnpm install
pnpm build
cp .env.example .env          # edit values locally; never commit real secrets
pnpm --filter @zclear/api db:migrate
pnpm --filter @zclear/api build
DATABASE_URL=postgresql://app:change_me@localhost:5432/clearing_dev \
  node apps/api/dist/scripts/seed-review-demo.js
pnpm dev                      # API :3000, web :5173 (web proxies /api)
```

- The repo's migrations are the source of truth: `apps/api/migrations` runs
  through `node-pg-migrate` against `DATABASE_MIGRATION_URL`. They create the
  schema, RLS policies, versioned config tables and the `NEEDS_VERIFICATION`
  VAT seed.
- `seed-review-demo.ts` is the local reset/seed script added by Dev 1. It
  upserts fixed synthetic tenants, users, a draft shipment, an in-flight review
  revision and a points entry. It refuses to run when `NODE_ENV=production`.
- `smoke-review.ts` is the real-API smoke check for the importer review flow.
- To start clean locally, recreate an empty database you own, re-run
  `db:migrate`, then run the seed script. Never drop a database you do not own.
- API tests boot their own ephemeral PostgreSQL; Docker is not required for
  tests. Docker/compose has not been verified locally.

## 2. Launch each role at phone width

1. Open `http://localhost:5173` in a browser and set DevTools device emulation
   to a small phone width (for example 390 x 844).
2. The app shows a sign-in form. Use credentials issued by the demo seed — none
   are hardcoded in the source.
3. **Agent view:** sign in as `agency_owner` or `agent_staff`. The header badge
   reads "Agency owner" or "Clearing agent".
4. **Importer view:** sign out, then sign in as `client_viewer`. The header badge
   reads "Importer / client".
5. To switch roles quickly, sign out between runs; the demo token is held in
   `sessionStorage` only.
6. The **MOCKUPS** toggle in the app shell reveals six static labelled screens
   (SIM sign-up/PIN, registry guidance, SMS status, Zamtel Money payment, agent
   reviews, Cross check-in). Each has a `MOCK` badge and says "sample data only
   — no API calls". Announce each one aloud as "this screen is a mock-up".

## 3. Exact click-by-click demo order

Follow this order; the spoken lines are in `docs/demo-script.md`.

1. **Importer picks an agent (mock).** Show the directory/rating card from
   Dev 1's `mockups/`. Say "this screen is a mock-up".
2. **Agent sends a draft (real API).** Use the seeded shipment and
   `POST /api/v1/shipments/:id/review/send`. The draft check runs
   deterministically; a blocked draft stays a draft and sends nothing.
3. **Draft check flags the quantity (real API).** Show the `draftFindings` from
   the review summary. The rule is code, not a customs validation.
4. **Importer queries (real API).** `POST /api/v1/reviews/:id/query`.
5. **Agent corrects (real API).** `POST /api/v1/reviews/:id/revise`, then send
   again. Material edits bump review freshness; stale approvals are rejected.
6. **Importer approves (real API).** `POST /api/v1/reviews/:id/approve`. One
   append-only points entry is written per earned event.
7. **Points / directory card (mock screen).** The points ledger is real in the
   API; the directory card showing the rating line is a static mock-up. Say
   "this screen is a mock-up".
8. **Roadmap close (slide, 20 seconds).** Show `docs/roadmap.md`. Read the items
   as "Roadmap, not built".

Optional, only if asked or if time remains: show the **real** case-file header
(reference, client, route/goods, current stage) and the read-only stage-history
timeline from the API. Do not show an "Activity" list: there is no audit-log read
endpoint, so the stage timeline is shown instead.

## 4. What is real, mocked and roadmap

**Real (backed by code in this repo):**

- Tenant-scoped sign-in, JWT access token, rotating refresh, RBAC and role badge
  from `GET /api/v1/auth/me`.
- Shipments list and case-file detail from `GET /api/v1/shipments` and
  `GET /api/v1/shipments/:id`.
- Append-only stage timeline from `GET /api/v1/shipments/:id/events` (embedded
  in the detail response). Stage updates are manual and one-tap.
- Document checklists/uploads behind private storage, with a scan-status gate.
  Default scanner is a no-op (`skipped`); `SCAN_PROVIDER=clamav` talks to an
  external daemon and fails closed when it is unreachable.
- Quotes, invoices, recorded payments and per-tenant invoice numbering in the
  API. VAT is config, flagged `NEEDS_VERIFICATION`. Invoices have an
  authenticated PDF snapshot download (`GET /api/v1/invoices/:id/pdf`).
- Importer review: send → query → revise → approve, deterministic draft check,
  stale-approval rejection, append-only points ledger.
- One-way handoff artifact: `POST /api/v1/shipments/:id/handoff-export` returns
  versioned JSON for an agent to key into ASYCUDA World by hand, with an audit
  entry. It is not a submission and there is no live link.
- Notification outbox: events from invoice issue/payment and review
  send/query/approve append delivery outcomes; the pilot channel is email via a
  configurable webhook. Default provider is `mock` and nothing is sent.
- Agency-owned document-requirement configuration endpoints with RLS and audit.
- Phone-first case-file header, role badge and stage timeline in `apps/web`.

**Mocked (sample data, not built):**

- The six screens in `apps/web/src/mockups/`: agent directory/rating, SIM sign-up
  and PIN, registry guidance, SMS status, Zamtel Money fee payment, agent
  reviews and Cross check-in. They carry a `MOCK` badge and use sample data only.
- Use `Mock-up, sample data` on screen and say "this screen is a mock-up" aloud.

**Roadmap, not built:**

- Every row in `docs/roadmap.md`, including a polished downloadable handoff
  file/UI, Cross check-in UI, cell-tower tracking, Zamtel Money integration and
  real SIM verification.

## 5. Before you record

- Confirm the deadline, portal, upload method, file limits and submitter with
  the organisers (draft in `docs/organisers-email.md`).
- Check audio: audible, 5 minutes or less, no background noise.
- Confirm the commit or tag being demonstrated and paste the test results into
  `docs/submission-checklist.md`.
- Save the submission confirmation and record where it was saved.
