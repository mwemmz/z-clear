# Security

Security requirements for the Clearing Agent Platform, the current posture, and
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

### Authentication (Phase 1)
- Argon2id password hashing; reject known-breached passwords.
- Short-lived access tokens; rotating refresh tokens in `httpOnly`, `Secure`,
  `SameSite` cookies, with server-side revocation.
- TOTP 2FA optional for `agency_owner`, required for `platform_admin`.
- Login rate limiting with backoff. Generic errors (no account enumeration).

### Authorization (Phase 1)
- Central RBAC + tenant-scope policy layer; deny by default.
- Prevent IDOR by always scoping lookups to `(tenant_id, id)`.
- CI test fails if any endpoint lacks a permission declaration.

### Tenancy isolation (Phase 1)
- Two layers: application scoping on every query, plus RLS keyed to a
  per-request `SET LOCAL app.tenant_id`.
- Tests attempt cross-tenant reads and writes on every tenant-owned table and
  must prove they fail.

### Public status links (Phase 4)
- 128-bit+ random tokens, stored **hashed**, with expiry and revocation.
- Rate limited per IP and per token.
- Minimal whitelisted payload: stage, last update, missing-document **names**.
  Never internal notes, fees, or other shipments. `noindex`; no sensitive data
  in URLs beyond the token.

### Files and documents (Phase 3)
- Private buckets; downloads via short-lived signed URLs after an authz check.
- Type validation by content; size limits; malware scan in a background job
  before a file is marked available.
- Never render uploaded HTML/SVG inline.

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

## CI checklist (must reference these)

- [ ] Format, lint, type check and tests pass (`.github/workflows/ci.yml`).
- [ ] `pnpm audit --audit-level high` runs (hard gate from Phase 1).
- [ ] gitleaks secret scan passes.
- [ ] Every endpoint has schema validation and a permission declaration (Phase 1).
- [ ] Cross-tenant isolation tests pass (Phase 1).
- [ ] Migrations run clean on a fresh DB (Phase 1).
- [ ] No secrets, real data, or unlisted security gaps.

## Open items

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
