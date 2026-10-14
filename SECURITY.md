# Security

Security requirements for Z Clear, the current posture, and
the checks CI must reference. Controls marked **(Phase n)** are specified here
and implemented in that phase; Phase 0 already implements the ones marked
**(Phase 0)**.

## Threat model (STRIDE)

Scope: the API, the web client, public status links, uploaded documents, and the
notification channel. Out of scope by design: ASYCUDA World (we never touch it).

| STRIDE | Example threat | Primary controls |
|---|---|---|
| **Spoofing** | Credential stuffing, stolen refresh token, forged public link | Argon2id + breached-password check, short access TTL, rotating refresh in httpOnly/Secure/SameSite cookies with revocation, TOTP (owners, required for `platform_admin`), 128-bit random public tokens (Phase 1/4) |
| **Tampering** | Editing another tenant's shipment, forging audit rows | Tenant scoping on every query **and** PostgreSQL RLS; append-only `audit_logs`/`shipment_events` with a DB role that cannot UPDATE/DELETE (Phase 1/2) |
| **Repudiation** | "I never changed that stage" | Every state change writes an append-only event with actor, time, from/to, source (Phase 2) |
| **Information disclosure** | Cross-tenant leak, IDOR, public link exposing fees/notes, document scraping, secret in logs | Look up by `(tenant_id, id)` not id alone; RLS; whitelisted public payload; short-lived signed URLs after authz; PII redaction in logs (Phase 0); no stack traces to clients (Phase 0) |
| **Denial of service** | Credential stuffing, public-link hammering | Login rate limiting with backoff, per-IP and per-token limits on public links, per-tenant quotas (Phase 1/4) |
| **Elevation of privilege** | Missing permission check on an endpoint | Central policy layer, deny by default, every endpoint declares a permission and a test fails the build if one does not (Phase 1) |

### Prompt injection (AI, post-MVP)

Uploaded documents and inbound messages are untrusted and may contain hidden
instructions. Defense: a model reading untrusted content gets **no tools** and no
access to other shipments or tenants; it returns strict schema output only;
humans confirm all side effects; tools, if ever added, are least-privilege,
tenant-scoped and read-only by default; model output is treated as untrusted
data. Full detail in `docs/ai-safety.md` (Phase 8, not built).

## Controls by area

### Authentication (Phase 1, shipped)
- Argon2id password hashing. **Not yet:** known-breached-password rejection.
- Short-lived signed JWT access tokens (15m default); opaque refresh tokens
  stored only as SHA-256 hashes, rotated on every use, revocable server-side and
  delivered in an `httpOnly`, `SameSite=Lax`, `Secure`-in-production cookie.
- Account lockout after repeated failed logins; generic errors everywhere (no
  account enumeration). Login/refresh are rate limited (`@nestjs/throttler`).
- **Scaffolded, not enforced:** TOTP 2FA. The secret column and primitives
  exist; enforcement (optional for `agency_owner`, required for
  `platform_admin`) lands in a later phase.

### Authorization (Phase 1, shipped)
- Central RBAC + tenant-scope policy layer; deny by default. Every non-public
  route must declare permissions; a build-time test fails otherwise.
- IDOR prevention by always scoping lookups to `(tenant_id, id)`.

### Tenancy isolation (Phase 1, shipped)
- Two layers: application scoping on every query, plus RLS keyed to a
  per-request `SET LOCAL app.tenant_id`. Policies are fail-closed, and
  `nullif(current_setting('app.tenant_id', true), '')` guards the empty-string
  reset value so an unset tenant yields no rows instead of a cast error.
- The application connects as a **non-owner** DB role, so it cannot bypass RLS.
- Tests attempt cross-tenant reads and writes and prove they fail, and verify
  `audit_logs` is append-only.

### Public status links (Phase 4)
- 128-bit+ random tokens, stored **hashed**, with expiry and revocation.
- Rate limited per IP and per token.
- Minimal whitelisted payload: stage, last update, missing-document **names**.
  Never internal notes, fees, or other shipments. `noindex`; no sensitive data
  in URLs beyond the token.

### Files and documents (Phase 3, shipped)
- Private, tenant-scoped storage behind a provider interface: in-memory for
  dev/test, S3-compatible (R2/MinIO) for production. Keys are namespaced
  `${tenant_id}/${shipment_id}/${file_id}`; object storage is never public.
- Uploads are size-limited and content-type allowlisted, and are re-checked
  server-side after the multipart body is parsed. Oversize is `413`, bad type
  is `400`.
- Downloads are authorized first (lookup by `(tenant_id, id)`), then served via
  a short-lived signed URL (`SIGNED_URL_TTL_SECONDS`) or an authenticated stream.
  Responses are `Content-Disposition: attachment` with `X-Content-Type-Options:
  nosniff`; uploaded HTML/SVG is never rendered inline.
- A scan-status gate blocks download while a file is `pending`, `infected` or
  `failed`. The default scanner is a no-op (`skipped`); a real malware scanner
  is an open item.
- Uploads and downloads carry tighter per-IP throttles (30/min and 60/min) than
  the global 120/min default, and the multipart reader is capped at one file per
  request.

### Input and output (Phase 0 + ongoing)
- **(Phase 0)** Schema validation on every request; unknown fields rejected.
- **(Phase 0)** One error envelope; no stack traces or internals to clients.
- **(Phase 0)** Structured logs with PII redaction.
- **(Phase 0)** `helmet` security headers; CORS allowlist.
- **(ongoing)** Parameterized queries only; output encoding; strict CSP; CSRF
  protection; sanitize data into PDFs and CSV/XLSX (guard formula injection for
  cells starting with `=`, `+`, `-`, `@`).

### Secrets and infrastructure
- **(Phase 0)** Secrets only from environment; `.env` gitignored; `.env.example`
  holds placeholders only; secret scanning (gitleaks) in CI.
- Separate keys per environment; TLS everywhere; encryption at rest.
- Field-level encryption for sensitive fields (e.g. client tax numbers).
- Least-privilege DB roles (the app role cannot write audit tables).
- Dependency audit + lockfile; structured logging; PII redaction.

### Privacy
- Per-tenant retention settings; data export and deletion on request; consent
  records for WhatsApp/SMS.
- **Unverified:** the exact obligations of Zambia's data-protection law have not
  been confirmed from primary sources in this environment. Confirm statutory
  retention, lawful basis, and cross-border transfer rules before production.
  Tracked as an open item.

## What Phase 0 already does

- Fail-fast environment validation with a readable error (`loadEnv`).
- Single API error envelope; internal errors logged, never returned.
- Request correlation id on every request and response.
- `helmet` headers, `compression`, CORS allowlist from env.
- Pino structured logging with redaction of auth headers, cookies, tokens,
  secrets, emails and phone numbers.
- Health endpoint and code-generated OpenAPI.

## What Phase 1 already does

- Two-layer tenancy: application scoping plus fail-closed Postgres RLS, with the
  app connecting as a non-owner role.
- Append-only `audit_logs` enforced by a database trigger, not just convention.
- Argon2id passwords; rotating, hash-stored, revocable refresh tokens in an
  `httpOnly` cookie; short-lived access tokens; login lockout and rate limiting;
  generic auth errors.
- Central permission matrix with a deny-by-default global guard and a build-time
  test that fails when a route omits its policy declaration.
- End-to-end isolation and auth tests run against a real PostgreSQL.

## What Phase 2 already does

- `shipments` and `shipment_events` are tenant-owned and covered by the same
  fail-closed RLS policies as Phase 1; isolation tests exercise the new tables.
- The stage timeline is append-only enforced by a database trigger, so a stage
  change can never be silently edited or erased — the audit trail for
  repudiation is the row itself.
- A stage change writes the shipment, its `shipment_events` row and its
  `audit_logs` entry in one transaction with the actor id, from/to stages and
  source, so state and history cannot diverge.
- Stage/type input is validated against a single shared enum; unknown values and
  unknown fields are rejected, and a hold requires a reason (also a DB
  constraint).
- Tariff/duty tables ship **empty** and flagged `NEEDS_VERIFICATION`; no duty,
  VAT or fee numbers are invented, and the tables hold no tenant data.

## What Phase 3 already does

- `documents`, `files` and `document_requirements` are tenant-owned and covered
  by the same fail-closed RLS policies as Phase 1/2; isolation tests exercise
  the new tables (a second tenant sees `404` for both a shipment's checklist and
  a file download).
- Uploads are capped by `MAX_UPLOAD_BYTES` and restricted to
  `ALLOWED_UPLOAD_TYPES`; the service re-validates size and type after parsing,
  so a fabricated `Content-Type` does not bypass the allowlist.
- Every file record stores a `sha256` checksum, size, original name and the
  provider's storage key; checklists derive their `missing` list from a
  satisfied document (`pending`/`uploaded`/`verified`, not `rejected`).
- Downloads are authorized by `(tenant_id, id)` before any signed URL is minted;
  a file whose scan status is `pending`/`infected`/`failed` cannot be downloaded.
- Deleting a document cascades its file rows and best-effort removes the objects
  from storage.
- The storage driver is selected by `STORAGE_DRIVER`; production requires an
  S3-compatible bucket (validated in config), and the in-memory driver refuses
  to run in production.

## CI checklist (must reference these)

- [ ] Format, lint, type check and tests pass (`.github/workflows/ci.yml`).
- [ ] `pnpm audit --audit-level high` runs (hard gate from Phase 1).
- [ ] gitleaks secret scan passes.
- [ ] Every endpoint has schema validation and a permission declaration (Phase 1).
- [ ] Cross-tenant isolation tests pass (Phase 1).
- [ ] Migrations run clean on a fresh DB (Phase 1).
- [ ] No secrets, real data, or unlisted security gaps.

## Open items

0. Phase 1 gaps still to close: wire breached-password checks, enforce TOTP,
   and move login throttling from in-memory to a shared store before running
   more than one replica.
1. Confirm Zambian data-protection obligations (see Privacy).
2. Confirm breach-notification duties and any sector retention rules.
3. Decide the public-link retention window and whether clients can self-revoke.
4. **Dependency override (revisit):** `pnpm.overrides.tinypool` forces
   `tinypool@^2.1.2` to clear two critical advisories in Vitest's transitive
   worker pool. Vitest 3.2.7 declares `tinypool@^1.1.1`, so this forced major
   version is out of its stated range: it passes the full test suite today but
   must be dropped once Vitest ships a release that depends on the patched
   version. Remaining `pnpm audit` findings are dev-only (vitest, @vitest/mocker,
   js-yaml) and moderate; the CI gate is `--audit-level high`.
5. **Real malware scanning (Phase 3):** the default `SCAN_PROVIDER` is a no-op
   that records `skipped`. Files are therefore downloadable once uploaded.
   A real AV scanner (e.g. ClamAV) should run as a background job before a file
   is marked available; the gate and status model already support it.
6. **Document requirements are unmanaged:** `document_requirements` ships empty
   with no admin endpoints; agencies must load their checklists (config over
   code). No default checklist is invented.
7. **In-memory storage driver** loses objects on restart and is rejected in
   production; only the S3-compatible driver retains files.
