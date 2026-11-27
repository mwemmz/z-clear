# Future Plans - Z Clear

Handoff for the next agent. Read `AGENTS.md`, `ARCHITECTURE.md` and `SECURITY.md`
before making changes. This is a handoff, not a promise: anything below marked
`Roadmap, not built` must stay out of "built" claims in the demo and submission.

## Phase 4 status (completed)

- Billing module implemented: quotes and invoices with integer minor-unit money.
- Pricing helper: VAT applies only to service-fee lines (pass-through lines not
  taxed); taxability from charge-type config.
- Quotes: draft → sent → accepted/declined/expired; drafts editable;
  accepted/declined/expired final; draft → accepted allowed.
- Invoices: created from accepted quote (snapshot) or standalone lines; ZMW-only;
  issued immutable (void with reason); sequential per-tenant numbers
  (`INV-<year>-<seq>`).
- Payments: append-only (DB trigger); status derived (issued/partially_paid/paid).
- RLS fail-closed; permissions: `quote:read|write`, `invoice:read|write`,
  `payment:record`; `client_viewer` read-only.
- VAT: 16% (1600 bp), seeded as `NEEDS_VERIFICATION`.
- Tests: billing e2e (10 tests) + full API suite (10 files, 52 tests passed).

## Prototype surface added in this handoff

- `apps/web/src/api.ts`: small `/api/v1` client (login, `/auth/me`, shipments
  list/detail). No credentials or customer data in source.
- `apps/web/src/App.tsx`: phone-first sign-in, role badge, case-file header
  (reference, client, route/goods summary, current stage) and a read-only
  stage-history timeline. Data comes from `GET /shipments` and `GET :id`.
- `apps/web/src/index.css`, `apps/web/src/App.spec.tsx`: styles and five tests.
- **No audit-log read endpoint exists** (`AuditModule` only writes). Per the
  owner's instruction, none was added; the UI shows the stage-events timeline
  from `GET /shipments/:id/events` (also embedded in `GET :id`) instead of an
  "Activity" list. Do not add an audit read endpoint without an explicit
  owner decision on access control and redaction.

## Phase 5 - status (completed in this handoff)

Dev 1's importer-review feature was merged from `feat/importer-review-api` at
`ca2cdf4`, alongside the case-file UI. The remaining Phase 5 slices are now in
the working tree:

1. **One-way handoff export (Real).** `POST /api/v1/shipments/:id/handoff-export`
   returns a versioned JSON artifact (shipment, stage events, issued invoice)
   and writes `handoff.export_created` to the audit log. Guardrail upheld: no
   scraping, automation or replacement of ASYCUDA World; `integrations/` stays
   empty. A polished downloadable file and review UI remain `Roadmap, not built`.
2. **Invoice PDF (Real).** `GET /api/v1/invoices/:id/pdf` renders an immutable
   snapshot with `invoice.pdf_generated` audit. Issued invoices are never
   edited in place. Short-lived signed-link delivery is not added because the
   private download route already authorizes per request.
3. **Notifications (Real seam, unconfigured delivery).** Append-only
   `notification_outbox` plus a provider interface. Recipients come from tenant
   users, never fixtures. `mock` is the default and sends nothing; `email`
   posts to a configurable webhook and requires `NOTIFICATION_FROM` +
   `NOTIFICATION_WEBHOOK_URL`. Events: invoice issued/payment recorded and
   review sent/queried/approved. SMS/WhatsApp fail closed as roadmap.
4. **Malware scanning (Real seam, external daemon required).** `SCAN_PROVIDER=clamav`
   speaks INSTREAM to clamd; unreachable/timeout reports `failed`, which keeps
   downloads blocked. Default `noop` still reports `skipped` because no daemon
   is bundled.
5. **Document requirements (Real API, UI roadmap).** Tenant-scoped list/create/
   update/delete with RLS, zod validation, permissions and audit rows. The table
   ships empty; no ZRA document list is invented. A management UI is
   `Roadmap, not built`.
6. **Web case-file refinements.** Only surface data the API already returns;
   keep stage updates one-tap and phone-first; do not invent live customs
   status.

## Roadmap (slide-only, not built)

See `docs/roadmap.md` for the one-line items and their guardrails: polished
handoff file/UI, Cross check-in/border-ready UI, cell-tower tracking, Deliver
forecasts/trade indicators, Zamtel Money, local languages, real SIM
verification. Every line is labelled `Roadmap, not built`.

## Demo and submission

Owner-supplied documents live under `docs/`: `roadmap.md`, `demo-runbook.md`,
`demo-script.md`, `solution-overview.md`, `submission-checklist.md`,
`organisers-email.md`. Sections 7-10 of the owner's additional instructions
are **pending the workload plan file the owner will provide**; do not guess
where they belong or claim anything is Real without that file's Real column.

## Mock policy

- Dev 1 delivered `apps/web/src/mockups/`: six static screens behind the
  **MOCKUPS** toggle, wrapped in `MockScreen` with a `MOCK` badge and a
  "Sample data only — no API calls" note. Announce each as "this screen is a
  mock-up" and keep the `Mock-up, sample data` label for slide fallbacks.
- Fallback mocks are no longer needed: the conditional Friday-midday gate was
  satisfied by Dev 1's merge. Do not add more mock screens without an owner
  request.
- All data shown in demos must be synthetic. No real client, cargo, customs,
  payment or SIM data.

## Open items and verification gates

- Docker/compose images have not been exercised locally (Docker unavailable).
- VAT 16% is `NEEDS_VERIFICATION` against a current ZRA source.
- ClamAV provider is implemented but no scanner daemon is bundled or configured;
  default remains `noop`/`skipped`.
- Email delivery webhook and sender are not configured; default is `mock`, so
  nothing is sent in the demo. Confirm the pilot provider with the owner.
- `integrations/` is intentionally empty.
- Before the Phase 3 owner gate, keep phases 0-2 lean; the owner later asked to
  start Phase 3 then do lean hardening, so confirm direction before building
  beyond Phase 5.
- Verification chain before any commit: `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm build`, `pnpm test` (or `pnpm verify`), plus
  `pnpm audit` and `pnpm secrets:scan` where available.

## Conventions

- Money: integer minor units; ISO currency (ZMW default). No floats.
- Tenancy: `(tenant_id, id)`; RLS enforced; cross-tenant returns 404.
- Append-only: `audit_logs`, `shipment_events`, `payments` (trigger); state
  changes audited.
- Config over code: checklists, fees, stage labels, export mappings.
- Migrations run clean fresh and on the previous version.
- Every endpoint: schema validation, permission declaration, rate limiting
  where relevant, audit entry for state changes.
- Tests required; lint/typecheck/build/test green.

## Build/Test

`pnpm install; pnpm verify; pnpm audit; pnpm secrets:scan`

## Notes

- `integrations/` is intentionally empty - do not integrate with ASYCUDA/ZRA.
- Stage updates are manual, one-tap, phone-first.
