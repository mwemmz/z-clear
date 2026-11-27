# Z Clear - where we are vs where we need to go

Baseline: `master` at `ca2cdf4` (Phase 4 billing + Dev 1's importer-review Phase
5 + the API-backed case-file UI). "Real" means backed by code and covered by
tests. Nothing in this document may be described as integrated with ZRA or
ASYCUDA World.

## 1. Where we are

| Area | Status | Evidence |
|---|---|---|
| Tenancy, Argon2id auth, JWT + refresh, RBAC, RLS, audit log | **Real** | Phase 1 modules and cross-tenant e2e tests |
| Shipments, one-tap stage updates, append-only `shipment_events` | **Real** | `apps/api/src/modules/shipments`, `shipments.e2e.spec.ts` |
| Document checklists, private storage, signed downloads, scan-status gate | **Real** | Phase 3; default scanner is a no-op (`skipped`) |
| Quotes, ZMW invoices, payments, per-tenant numbering, VAT config | **Real** | Phase 4; VAT 16% flagged `NEEDS_VERIFICATION` |
| Importer review: send → query → revise → approve, draft check, points ledger | **Real** | Dev 1's `reviews` module, `reviews.e2e.spec.ts` |
| Phone-first UI: role badge, case-file header, read-only stage timeline | **Real** | `apps/web/src/App.tsx`, `App.spec.tsx` |
| Six static labelled mock screens behind a demo toggle | **Mocked** | `apps/web/src/mockups/` — `MOCK` badge, sample data only |
| Agent directory, draft-screen visuals, SMS/Zamtel/Cross screens | **Mocked** | Static screens; no live provider or registry |
| One-way handoff artifact + PDF snapshot + notification outbox + requirements API | **Real** | Phase 5 slices added in this handoff (tests below) |
| ClamAV INSTREAM provider behind config | **Real seam, external daemon required** | `SCAN_PROVIDER=clamav`; default `noop` reports `skipped` |
| Roadmap items (polished handoff file/UI, Cross, tracking, Deliver, etc.) | **Roadmap, not built** | `docs/roadmap.md` |
| Workload plan with a "Real" column and the MOCKS section | **Blocked** | Owner said they will provide the file; sections 7-10 are held |
| Audit-log read endpoint | **Absent by decision** | `AuditModule` is write-only; UI shows the stage timeline instead |

## 2. Where we need to go

| Gap | Deliverable | Guardrail / open decision |
|---|---|---|
| API artifact exists but no downloadable file/UI | Polished handoff file + review screen | **Roadmap, not built**; no ASYCUDA integration, scraping or automation |
| PDF download exists; no private stored artifact/signed link | Store generated PDFs privately if needed | Issued invoices are immutable; regenerate as a new artifact, never edit |
| Notification outbox exists; no provider configured | Configure pilot email webhook + sender | Pilot channel is email; no real addresses in code or fixtures (only `example.com` placeholders in unit tests); `FEATURE_NOTIFICATIONS` off by default |
| Requirements API exists; no management UI | Tenant-scoped management UI | Never invent a ZRA document list; agencies configure their own |
| ClamAV provider exists; no daemon bundled | Point `SCAN_PROVIDER=clamav` at a real clamd | Downloads stay blocked while `pending`/`infected`/`failed` |
| Demo docs still describe the pre-merge world | Update runbook, script, overview, `FUTURE_PLANS.md` | Only the Real column from the workload plan may be claimed as built |
| VAT 16% unverified | Confirm against a current ZRA source | Ask the owner; keep `NEEDS_VERIFICATION` until then |
| Docker/compose untested | Exercise local stack where Docker is available | Environment limitation, not a code change |
| Submission logistics unconfirmed | Organiser email + completed checklist | Deadline, portal, file limits, submitter = registered group leader |

## 3. Next steps in order

1. Build the Phase 5 slices: handoff export, invoice PDF, notifications,
   document requirements management, ClamAV provider.
2. Update the demo docs to match what is actually Real after those slices.
3. Run `pnpm verify`, commit and push.
4. Owner: provide the workload plan file, confirm VAT and phase direction,
   send the organiser email, record the ≤5-minute video.
