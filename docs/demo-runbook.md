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
pnpm dev                      # API :3000, web :5173 (web proxies /api)
```

- Migrations are in `apps/api/migrations` and run through `node-pg-migrate`
  against `DATABASE_MIGRATION_URL`. They create the schema, RLS policies,
  versioned config tables and the `NEEDS_VERIFICATION` VAT seed.
- **TODO (Dev 1): replace this line with the exact reset-and-seed script name**
  once supplied. Until then, seed only synthetic tenants/users/shipments by a
  documented local script; do not hand-enter data into a shared database.
- To start clean locally, recreate an empty database, re-run `db:migrate`, then
  run the seed script. Never drop a database you do not own.
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

## 3. Exact click-by-click demo order

Follow this order; the spoken lines are in `docs/demo-script.md`.

1. **Importer picks an agent (mock).** Show the directory/rating card from
   Dev 1's `mockups/` folder. Say "this screen is a mock-up". If the folder is
   not available, show the slide with `Mock-up, sample data` instead.
2. **Agent sends a draft (mock).** Show the draft-send screen. Say it is a mock-up.
3. **Draft check flags the quantity (mock).** Show the check result highlighting
   the quantity mismatch. Say it is a mock-up.
4. **Importer queries (mock).** Show the query screen. Say it is a mock-up.
5. **Agent corrects (mock).** Show the corrected draft. Say it is a mock-up.
6. **Importer approves (mock).** Show the approval screen. Say it is a mock-up.
7. **Points update (mock).** Show the agent rating/points line. Say it is a
   mock-up.
8. **Roadmap close (slide, 20 seconds).** Show `docs/roadmap.md`. Read the items
   as "Roadmap, not built".

Optional, only if asked or if time remains: sign in as an agent and show the
**real** case-file header (reference, client, route/goods, current stage) and
the read-only stage-history timeline. These come from the API, not a mock-up.
Do not show an "Activity" list: there is no audit-log read endpoint, so the
stage timeline is shown instead.

## 4. What is real, mocked and roadmap

**Real (backed by code in this repo):**

- Tenant-scoped sign-in, JWT access token, rotating refresh, RBAC and role badge
  from `GET /api/v1/auth/me`.
- Shipments list and case-file detail from `GET /api/v1/shipments` and
  `GET /api/v1/shipments/:id`.
- Append-only stage timeline from `GET /api/v1/shipments/:id/events` (embedded
  in the detail response). Stage updates are manual and one-tap.
- Document checklists/uploads behind private storage, with a scan-status gate
  (the default scanner is a no-op — say so if asked).
- Quotes, invoices, recorded payments and per-tenant invoice numbering in the
  API. VAT is config, flagged `NEEDS_VERIFICATION`.
- Phone-first case-file header, role badge and stage timeline in `apps/web`.

**Mocked (sample data, not built):**

- Agent directory, rating line, draft send/check/query/correct/approve screens,
  points update, SMS status messages, Zamtel Money fee payment, Cross check-in,
  3-step registry guidance. None of these are implemented in `apps/web`.
- Use `Mock-up, sample data` on screen and say "this screen is a mock-up" aloud.

**Roadmap, not built:**

- Every row in `docs/roadmap.md`, including ASYCUDA handoff export, cell-tower
  tracking, Zamtel Money integration and real SIM verification.

## 5. Before you record

- Confirm the deadline, portal, upload method, file limits and submitter with
  the organisers (draft in `docs/organisers-email.md`).
- Check audio: audible, 5 minutes or less, no background noise.
- Confirm the commit or tag being demonstrated and paste the test results into
  `docs/submission-checklist.md`.
- Save the submission confirmation and record where it was saved.
