# Z Clear

Multi-tenant SaaS for small and mid-size clearing and forwarding agents in
Zambia. One shared shipment record so clients always know where cargo is, what
documents are missing, and what they owe.

> Customs declarations, duty assessment and release happen in **ASYCUDA World**
> (ZRA). We do not integrate with or replace it. We handle the workflow around
> it and export clean data for agents to key into ASYCUDA.

See `ARCHITECTURE.md` for the design and `SECURITY.md` for the threat model.
`AGENTS.md` holds the working rules for development sessions.

## Layout

| Path | What |
|---|---|
| `apps/api` | NestJS API (modular monolith), `/api/v1`, generated OpenAPI at `/api/docs` |
| `apps/web` | React + Vite client, mobile-first |
| `packages/shared` | Shared domain types and pure helpers |
| `docker/` | Dockerfiles + nginx config |
| `.github/workflows/ci.yml` | Lint, typecheck, build, test, audit, secret scan |

## Requirements

- Node.js >= 22
- pnpm 10 (`corepack enable`)
- PostgreSQL 15+ and Docker (for the full local stack; optional in Phase 0)

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm build      # build shared first (pnpm handles topological order)
pnpm dev        # api on :3000, web on :5173 (proxies /api to the API)
```

With Docker available:

```bash
docker compose up --build
# api  :3000   web :8080   postgres :5432   minio :9000/:9001
```

## Checks

```bash
pnpm verify     # format:check + lint + build + typecheck + test
pnpm test       # tests only
pnpm audit      # dependency audit (high and above)
pnpm secrets:scan   # gitleaks (requires gitleaks installed)
```

## Database

Migrations live in `apps/api/migrations` and run with `node-pg-migrate` against
`DATABASE_MIGRATION_URL` (a least-privilege owner role); the app connects as a
separate non-owner role via `DATABASE_URL` so Postgres RLS is enforced.

```bash
pnpm --filter @zclear/api db:migrate     # apply migrations
pnpm --filter @zclear/api db:rollback    # roll back the last migration
pnpm --filter @zclear/api db:create name # scaffold a new migration
```

API tests boot an ephemeral PostgreSQL automatically (no Docker needed) and run
migrations on it; set `DATABASE_URL` to use an existing server instead.

## Status

- **Phase 0:** monorepo, tooling, CI, Docker, logging, error envelope, health +
  OpenAPI.
- **Phase 1:** tenancy, auth (Argon2id + JWT access + rotating refresh),
  RBAC, fail-closed Postgres RLS, append-only audit log, users + tenant
  endpoints. TOTP is scaffolded but not enforced yet.
- **Phase 2:** shipments with a manual one-tap stage pipeline and an
  append-only, tenant-isolated `shipment_events` timeline; empty, versioned
  tariff tables flagged `NEEDS_VERIFICATION` (no invented rates). See
  `ARCHITECTURE.md`.
- **Next:** documents and files (Phase 3), then quotes/invoices.
