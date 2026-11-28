# Z Clear - where we are vs where we need to go

Baseline: `master` at `351fc67` (Phase 4 billing, Dev 1's importer-review,
Phase 5 handoff/PDF/notifications/requirements/ClamAV slices, and the Render
deployment blueprint). "Real" means backed by code and covered by tests.
Nothing in this document may be described as integrated with ZRA or ASYCUDA
World.

## 1. Where we are

| Area | Status | Evidence |
|---|---|---|
| Tenancy, Argon2id auth, JWT + refresh, RBAC, RLS, audit log | **Real** | Phase 1 modules and cross-tenant e2e tests |
| Shipments, one-tap stage updates, append-only `shipment_events` | **Real** | `apps/api/src/modules/shipments`, `shipments.e2e.spec.ts` |
| Tenant-scoped `driver` role and manual border check-in | **Real** | `1738000000000_driver-checkins.js`, `driver-checkins.e2e.spec.ts`, `DriverCheckIn.tsx`, `docs/api/driver-checkin.json`; no stage change, no live border feed |
| Agent review inbox | **Real** | `AgentReviews.tsx` over `GET /reviews`; state, revision and query come from the API; no mock rating data |
| Document checklists, private storage, signed downloads, scan-status gate | **Real** | Phase 3; default scanner is a no-op (`skipped`) |
| Quotes, ZMW invoices, payments, per-tenant numbering, VAT config | **Real** | Phase 4; VAT 16% flagged `NEEDS_VERIFICATION` |
| Importer review: send → query → revise → approve, draft check, points ledger | **Real** | Dev 1's `reviews` module, `reviews.e2e.spec.ts` |
| Phone-first UI: role badge, case-file header, read-only stage timeline, split sign-in role guide | **Real** | `apps/web/src/App.tsx`, `App.spec.tsx`; no credentials embedded in the UI |
| Four synthetic demo logins (agent, importer, admin, driver), local and opt-in hosted | **Real** | `seed-review-demo.ts` hashes `DEMO_PASSWORD` locally or `HOSTED_DEMO_PASSWORD` in explicit `--hosted` mode; first-deploy hosted seed with DB marker; `docs/demo-accounts.md` |
| Importer self-service: typed own cases, labelled checklist, agent appointment, plain-language case status, valuation query, compliance assistant, SMS mock interface | **Real, branch `feat/importer-self-service`** | `FUTURE_PLANS.md` section 9; samples in `docs/api/case-status.json`, `docs/api/valuation-query.json` and `docs/api/compliance.json` |
| SMS notification interface (`sms_mock`) | **Real, sends nothing** | Outbox records skipped outcomes with tenant phone data; `sms`/`whatsapp` fail closed |
| Notification status UI and scoped read endpoint | **Real** | `GET /notifications` + `NotificationStatus.tsx`; no recipient address returned; importers see only their own outcomes |
| Tenant-owned registry guidance | **Real** | `GET/PATCH/POST/DELETE /guidance` + `RegistryGuidance.tsx`; nothing seeded, `VERIFIED` requires a source, audited and RLS-scoped; `docs/api/registry-guidance.json` |
| Manual invoice payment capture | **Real** | `PaymentCapture.tsx` over `GET/POST /invoices`; off-platform observation only, no provider or money movement; importer-scoped billing reads; `docs/api/invoice-payment.json` |
| Compliance assistant + illustrative estimator | **Real, estimator refuses by default** | Agency-owned prompts with provenance; only external `VERIFIED` rules produce a figure, `SAMPLE` mode labelled do-not-pay-or-file; `docs/ai-safety.md` |
| Credential-free Sample workspace with four login role cards, five synthetic roles, in-memory cases, one-tap stage changes, review query/approve/revise, payments and reset | **Real, simulated** | `apps/web/src/simulation.ts`, `api.ts` sample-token routing, `App.tsx`; no network requests, state persists across role switches, all records labelled sample |
| Static labelled mock screens behind a demo toggle, with disabled layout-only actions | **Mocked** | `apps/web/src/mockups/` — `MOCK` badge, sample data only, no network requests or fake check-in/payment state |
| Zamtel screens | **Mocked** | Static screens with disabled action buttons; no live provider or real SIM check |
| One-way handoff artifact + PDF snapshot + notification outbox + requirements API | **Real** | Phase 5 slices added in this handoff (tests below) |
| ClamAV INSTREAM provider behind config | **Real seam, external daemon required** | `SCAN_PROVIDER=clamav`; default `noop` reports `skipped` |
| Roadmap items (polished handoff file/UI, Cross, tracking, Deliver, etc.) | **Roadmap, not built** | `docs/roadmap.md` |
| Workload plan with a "Real" column and the MOCKS section | **Blocked** | Owner said they will provide the file; sections 7-10 are held |
| Audit-log read endpoint | **Absent by decision** | `AuditModule` is write-only; UI shows the stage timeline instead |
| Render deployment blueprint + guide | **Real, not deployed** | `render.yaml`, `docs/render-deploy.md`; dashboard secrets and service creation still pending |

The credential-free Sample workspace was added on branch
`feat/usable-simulated-workspace` so the previously gallery-only review and
stage screens are reachable in the live client. It uses role-only sample tokens
and the existing `/api/v1` response shapes; no API contract changed and no ZRA
or ASYCUDA integration was added.

## 2. Where we need to go

| Gap | Deliverable | Guardrail / open decision |
|---|---|---|
| API artifact exists but no downloadable file/UI | Polished handoff file + review screen | **Roadmap, not built**; no ASYCUDA integration, scraping or automation |
| PDF download exists; no private stored artifact/signed link | Store generated PDFs privately if needed | Issued invoices are immutable; regenerate as a new artifact, never edit |
| Notification outbox + local `sms_mock` interface exist; no real provider configured | Configure pilot email webhook + sender | Pilot channel is email; `sms_mock` sends nothing; `sms`/`whatsapp` fail closed; no real addresses in code or fixtures (only `example.com` placeholders in unit tests); `FEATURE_NOTIFICATIONS` off by default |
| Requirements API exists; no management UI | Tenant-scoped management UI | Never invent a ZRA document list; agencies configure their own |
| ClamAV provider exists; no daemon bundled | Point `SCAN_PROVIDER=clamav` at a real clamd | Downloads stay blocked while `pending`/`infected`/`failed` |
| Final demo docs and push | Update runbook, script, overview, `FUTURE_PLANS.md`; push approved branch to `master` | Only the Real column from the workload plan may be claimed as built; two labelled mocks remain |
| VAT 16% unverified | Confirm against a current ZRA source | Ask the owner; keep `NEEDS_VERIFICATION` until then |
| Docker/compose untested | Exercise local stack where Docker is available | Environment limitation, not a code change |
| Submission logistics unconfirmed | Organiser email + completed checklist | Deadline, portal, file limits, submitter = registered group leader |

## 3. Next steps in order

1. Deploy the Render blueprint with dashboard-only secrets and verify both
   services (health route + deployed web sign-in).
2. Update the demo docs to match what is actually Real after the Phase 5 slices.
3. Owner: provide the workload plan file, confirm VAT and phase direction,
   send the organiser email, record the ≤5-minute video.
