# Demo runbook

Use this to set up and run the 5-minute prototype demo. Everything shown must be
synthetic. Say "this screen is a mock-up" whenever a screen is not backed by the
API. Real vs mocked vs roadmap is listed at the end.

## 1. Reset and seed

```bash
corepack enable
pnpm install
pnpm build
cp .env.example .env          # set DATABASE_URL, DATABASE_MIGRATION_URL and DEMO_PASSWORD locally
pnpm --filter @zclear/api db:migrate
pnpm --filter @zclear/api build
node apps/api/dist/scripts/seed-review-demo.js
pnpm dev                      # API :3000, web :5173 (web proxies /api)
```

- The repo's migrations are the source of truth: `apps/api/migrations` runs
  through `node-pg-migrate` against `DATABASE_MIGRATION_URL`. They create the
  schema, RLS policies, versioned config tables and the `NEEDS_VERIFICATION`
  VAT seed.
- `seed-review-demo.ts` is the local reset/seed script. It upserts fixed
  synthetic tenants, four demo logins, one extra importer for isolation checks,
  a shipment, an in-flight review revision, a points entry and one issued
  invoice for a labelled synthetic agency service fee. It hashes
  `DEMO_PASSWORD` for the demo users, never logs it and refuses to run when
  `NODE_ENV=production`. The same data can be created on Render once via the
  explicit hosted job using `HOSTED_DEMO_PASSWORD`; normal startup never seeds
  demo data. See `docs/demo-accounts.md` for the sample emails.
- `smoke-review.ts` is the real-API smoke check for the importer review flow.
  It uses `DEMO_PASSWORD` (or `SMOKE_PASSWORD`) and sends no credential from source.
- To start clean locally, recreate an empty database you own, re-run
  `db:migrate`, then run the seed script. Never drop a database you do not own.
- API tests boot their own ephemeral PostgreSQL; Docker is not required for
  tests. Docker/compose has not been verified locally.

## 2. Launch each role at phone width

1. Open `http://localhost:5173` in a browser and set DevTools device emulation
   to a small phone width (for example 390 x 844).
2. The sign-in page has the form on the left and a short role guide on the right.
   Use one of the four synthetic logins in `docs/demo-accounts.md`; no email,
   password or autofill value is hardcoded in the app.
3. **Agent view:** sign in as the demo clearing agent (`agent_staff`). The header
   badge reads "Clearing agent".
4. **Importer view:** sign out, then sign in as the demo importer
   (`client_viewer`). The header badge reads "Importer / client".
5. **Admin and driver:** sign in as the demo admin (`platform_admin`) or driver
   (`driver`). The driver sees only the assigned shipment and can record a
   manual check-in.
6. To switch roles quickly, sign out between runs; the demo token is held in
   `sessionStorage` only.
7. Agency staff and drivers now see real review-inbox and check-in cards backed
   by the API; staff and importers also see a notification status card reading
   recorded outcomes from `GET /notifications` (the SMS mock sends nothing).
   Registry guidance is also real: the agency configures its own steps and the
   UI labels anything without a current source as guidance only. The invoice
   card is real: staff record a payment observed off-platform; no money moves
   here and it is not a customs payment. The **MOCKUPS** toggle reveals two
   remaining static labelled screens (SIM sign-up/PIN and Zamtel Money payment).
   Each has a `MOCK`
   badge and says "sample data only — no API calls". Announce each one aloud as
   "this screen is a mock-up".

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
  `GET /api/v1/notifications` returns those recorded outcomes without recipient
  addresses, and the UI states that the SMS mock sends nothing.
- Agency-owned document-requirement configuration endpoints with RLS and audit.
- Agency-owned registry guidance via `GET /api/v1/guidance`; no official list is
  seeded, and unverified steps are labelled as guidance only.
- Manual invoice payment capture over `GET/POST /api/v1/invoices`: staff record a
  payment already made off-platform; balances are derived, payments are
  append-only, and invoice/quote reads are scoped to the assigned importer. No
  Zamtel Money, bank or card provider is called. See
  `docs/api/invoice-payment.json`.
- Phone-first case-file header, role badge and stage timeline in `apps/web`.

**Mocked (sample data, not built):**

- The two screens in `apps/web/src/mockups/`: SIM sign-up and PIN and Zamtel
  Money fee payment, plus the agent directory rating line. They carry a `MOCK`
  badge and use sample data only.
- Use `Mock-up, sample data` on screen and say "this screen is a mock-up" aloud.

**Roadmap, not built:**

- Every row in `docs/roadmap.md`, including a polished downloadable handoff
  file/UI, cell-tower tracking, Zamtel Money integration and real SIM
  verification. The manual driver check-in UI is Real, not roadmap.

## 5. Before you record

- Confirm the deadline, portal, upload method, file limits and submitter with
  the organisers (draft in `docs/organisers-email.md`).
- Check audio: audible, 5 minutes or less, no background noise.
- Confirm the commit or tag being demonstrated and paste the test results into
  `docs/submission-checklist.md`.
- Save the submission confirmation and record where it was saved.
