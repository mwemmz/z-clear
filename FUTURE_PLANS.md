# Future Plans - zra (Z Clear)

This document captures next steps for another agent to pick up cleanly.

## Phase 4 Status (Completed)
- Billing module implemented: quotes and invoices with integer minor-unit money.
- Pricing helper: VAT applies only to service-fee lines (pass-through lines not taxed); taxability from charge-type config.
- Quotes: draft ? sent ? accepted/declined/expired; drafts editable; accepted/declined/expired final; draft?accepted allowed.
- Invoices: created from accepted quote (snapshot) or standalone lines; ZMW-only; issued immutable (void with reason); sequential per-tenant numbers (INV-<year>-<seq>).
- Payments: append-only (DB trigger); status derived (issued/partially_paid/paid).
- RLS fail-closed; permissions: quote:read|write, invoice:read|write, payment:record; client_viewer read-only.
- VAT: 16% (1600 bp), seeded as NEEDS_VERIFICATION.
- Tests: billing e2e (10 tests) + full API suite (10 files, 52 tests passed).

## Immediate Next Steps (Phase 5 - lean hardening)
1. Exports / ASYCUDA handoff: one-way handoff into ASYCUDA (do not integrate/scrape/automate); generate stable export artifact; audit action.
2. Invoice PDF / delivery: generate PDFs for invoices/quotes; signed storage or download.
3. Notifications: quote/invoice/payment events; template-based.
4. Real malware scanning: replace no-op SCAN_PROVIDER with ClamAV job; quarantine/block until clean.
5. Document requirements management: admin endpoints/UI to manage per-tenant requirements (no defaults invented).

## Mid-term
6. Accounting: credit notes/refunds model; exchange rate handling for non-ZMW; review Zambian rules.
7. VAT verification: confirm 16% against current ZRA source; update/remove NEEDS_VERIFICATION.
8. Security hardenings: breached-password checks, enforce TOTP, move login throttling to shared store.

## Conventions
- Money: integer minor units; ISO currency (ZMW default). No floats.
- Tenancy: (tenant_id, id); RLS enforced; cross-tenant returns 404.
- Append-only: audit_logs, shipment_events, payments (trigger); state changes audited.
- Config over code: checklists, fees, stage labels, export mappings.
- Migrations run clean fresh and on previous version.
- Every endpoint: schema validation, permission declaration, rate limiting where relevant, audit entry for state changes.
- Tests required; lint/typecheck/build/test green.

## Build/Test
pnpm install; pnpm build; pnpm lint; pnpm typecheck; pnpm test; pnpm verify

## Notes
- integrations/ is intentionally empty - do not integrate with ASYCUDA/ZRA.
- Stage updates are manual, one-tap, phone-first.