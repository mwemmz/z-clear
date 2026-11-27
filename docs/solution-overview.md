# Z Clear - solution overview (one page)

## The single problem

A Zambian clearing agent and their importer client have no shared, trustworthy
view of a consignment: documents go missing, stage changes are relayed by call
or WhatsApp, and nobody agrees on what is owed. Customs itself happens in
ASYCUDA World; the workflow *around* customs is where the confusion lives.

## How Z Clear solves it

One tenant-scoped shipment record is the case file. The agent records manual,
one-tap stage changes; the importer sees the same reference, client, route,
goods summary, current stage and a read-only stage timeline on a phone. Around
that record sit document checklists with private storage, quotes, invoices and
recorded payments. Data can be exported one way for the agent to key into
ASYCUDA — Z Clear does not integrate with, scrape or replace it.

## Built vs mocked vs roadmap

**Built (Real):** NestJS API with tenant isolation and RLS; Argon2id passwords,
JWT access + rotating refresh, RBAC; append-only audit log and shipment-event
timeline; shipments with one-tap stage updates; document checklists, private
tenant-scoped uploads and signed downloads behind a storage provider; quotes,
ZMW invoices (immutable once issued), recorded payments and per-tenant invoice
numbers; importer review (send/query/revise/approve, deterministic draft check,
stale-approval rejection, append-only points ledger); a one-way handoff artifact
and audit entry; authenticated invoice PDF snapshots; an append-only notification
outbox behind a provider seam (email off by default); agency-owned document
requirements with RLS; a configurable ClamAV provider that fails closed; an
importer compliance assistant and VERIFIED-only illustrative estimator; and a
React/Vite phone-first case-file header, role badge and stage history. The
SMS notification interface is a local mock that sends nothing.

**Mocked (sample data, not built):** six static screens in `apps/web/src/mockups/`
— agent directory and rating line, SIM sign-up/PIN, 3-step registry guidance,
SMS status, Zamtel Money fee payment, agent reviews and Cross check-in. They
carry a `MOCK` badge, say "sample data only — no API calls", and are announced
aloud in the demo.

**Roadmap, not built:** a polished downloadable handoff file and review UI,
Cross check-in/border-ready UI, cell-tower tracking, Deliver forecasts/trade
indicators, Zamtel Money integration, local languages, real SIM verification.
See `docs/roadmap.md`.

## Tools used

**Runtime and data:** Node.js >= 22, pnpm 10, TypeScript, PostgreSQL 15+,
S3-compatible object storage, Docker, GitHub Actions.

**API third-party libraries:** `@nestjs/common`, `@nestjs/core`, `@nestjs/jwt`,
`@nestjs/platform-express`, `@nestjs/swagger`, `@nestjs/throttler`,
`@node-rs/argon2`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`,
`kysely`, `pg`, `node-pg-migrate`, `zod`, `helmet`, `pino`, `pino-http`,
`compression`, `cookie-parser`, `dotenv`, `multer`, `reflect-metadata`, `rxjs`.

**Web third-party libraries:** `react`, `react-dom`.

**Dev/test third-party libraries:** `vite`, `@vitejs/plugin-react`, `vitest`,
`@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`,
`jsdom`, `supertest`, `embedded-postgres`, `@nestjs/cli`, `@nestjs/schematics`,
`@nestjs/testing`, `@swc/core`, `unplugin-swc`, `eslint`, `@eslint/js`,
`typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks`,
`eslint-plugin-react-refresh`, `globals`, `prettier`, `pino-pretty`,
`gitleaks` (CI secret scan). `@types/*` packages provide TypeScript types only.
`@zclear/shared` is an internal workspace package, not third-party.

**AI model:** No AI model is called by the application code. These submission
documents and the web case-file scaffold were prepared with the OpenCode coding
agent using the **Big Pickle** model; it is a drafting tool, not a runtime or
product dependency. No customer data was supplied to it. Full runtime AI and
tool disclosure is in `docs/ai-safety.md`.

## Synthetic-data statement

Every name, reference, amount, route and event used in the prototype and demo
is synthetic. No real customer, cargo, customs, payment, SIM or device data is
in the repository, logs, tests or demo. The seeded VAT rate is configuration
flagged `NEEDS_VERIFICATION`, not a verified ZRA figure.

## Next steps

Verify VAT against a current ZRA source; add a downloadable handoff file and
review UI, a document-requirements management UI, a web view for the review
flow, and real email credentials/webhook configuration; exercise Docker and a
live ClamAV daemon. Keep phases 0-2 lean until the owner validation gate passes.
