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

## Phase 5 - lean hardening and handoff export

1. **One-way ASYCUDA handoff export.** Produce a stable, reviewable artifact
   from a shipment/invoice; audit the export action. Guardrail: no scraping,
   automation, or replacement of ASYCUDA World; `integrations/` stays empty.
2. **Invoice PDF / delivery.** Render a PDF from the invoice snapshot; store
   privately and issue a short-lived signed link. Guardrail: never mutate an
   issued invoice; regenerating a document is a new artifact, not an edit.
3. **Notifications.** Email templates for quote/invoice/payment events (pilot
   channel chosen by owner). Guardrail: no client phone numbers or addresses
   in fixtures; send only to tenant-verified recipients.
4. **Real malware scanning.** Replace the no-op `SCAN_PROVIDER` (`skipped`)
   with a background AV job; keep downloads blocked while `pending`,
   `infected` or `failed`.
5. **Document requirements management.** Versioned, per-tenant requirement
   config and a management UI. Guardrail: no invented ZRA document lists.
6. **Web case-file refinements.** Only surface data the API already returns;
   keep stage updates one-tap and phone-first; do not invent live customs
   status.

## Roadmap (slide-only, not built)

See `docs/roadmap.md` for the one-line items and their guardrails: ASYCUDA
handoff export, Cross check-in/border-ready flag, cell-tower tracking, Deliver
forecasts/trade indicators, Zamtel Money, local languages, real SIM
verification. Every line is labelled `Roadmap, not built`.

## Demo and submission

Owner-supplied documents live under `docs/`: `roadmap.md`, `demo-runbook.md`,
`demo-script.md`, `solution-overview.md`, `submission-checklist.md`,
`organisers-email.md`. Sections 7-10 of the owner's additional instructions
are **pending the workload plan file the owner will provide**; do not guess
where they belong or claim anything is Real without that file's Real column.

## Mock policy

- No mock screens or `mockups/` folder exist in this repository. Anything not
  present in code is a mock-up or a slide, and must be labelled as such aloud
  and on screen (`Mock-up, sample data`).
- Fallback mocks are conditional on Dev 1 not having built them by Friday
  midday; confirm the date and Dev 1's status with the owner before adding any.
- All data shown in demos must be synthetic. No real client, cargo, customs,
  payment or SIM data.

## Open items and verification gates

- Docker/compose images have not been exercised locally (Docker unavailable).
- VAT 16% is `NEEDS_VERIFICATION` against a current ZRA source.
- Real AV scanning is not implemented; default scanner is a no-op.
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
