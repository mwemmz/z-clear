# Deploy to Render

Use this instead of the Vercel project. The repo's `render.yaml` is a Render
Blueprint that creates two services from `master`:

| Service | Type | Purpose |
|---|---|---|
| `zclear-api` | Node web service | NestJS API at `/api/v1`, OpenAPI at `/api/docs` |
| `zclear-web` | Static site | React/Vite client published from `apps/web/dist` |

Both deploy only after GitHub Actions checks pass (`autoDeployTrigger:
checksPass`). CI now uses the pnpm version from `package.json`, so the checks
are green on `master`.

## 1. Prepare Neon

Keep the existing Neon hosting decision. Provision **two roles** in the same
database:

```sql
CREATE ROLE zclear_migrator LOGIN PASSWORD '<strong-unique-password>';
CREATE ROLE zclear_app LOGIN PASSWORD '<strong-unique-password>' NOBYPASSRLS;
GRANT USAGE, CREATE ON SCHEMA public TO zclear_migrator;
GRANT USAGE ON SCHEMA public TO zclear_app;
```

- `DATABASE_MIGRATION_URL` uses `zclear_migrator` (owns schema changes).
- `DATABASE_URL` uses `zclear_app` (the API role). A table owner bypasses RLS,
  so these must not be the same role.
- Use Neon's pooled connection string for the API. Tenant context is set with
  `set_config(..., true)` inside a transaction, so transaction pooling is safe.

## 2. Prepare private object storage

Set `STORAGE_DRIVER=s3`. Use a **private** S3-compatible bucket and supply
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in
Render. The in-memory driver loses uploads on restart and must not be used in
production. No AV daemon is bundled: `SCAN_PROVIDER=noop` reports `skipped`;
point it at an external `clamd` only when one is available.

### Neon Object Storage bucket

The prototype's bucket is declared in `neon.ts` as a private bucket named
`uploads`. Recreate it with:

```bash
# First-time tooling setup; skip if the CLI and skills are already installed
neon init -y --project-id fragrant-cherry-98480328 --branch production \
  --services postgres,object-storage
# Link a fresh checkout to the already-configured branch
neon link --project-id fragrant-cherry-98480328 --branch production
# neon.ts already declares uploads; only use this when adding a new bucket
neon config add bucket uploads
neon deploy
```

`neon config add bucket uploads` exits with "already declares bucket" when the
declaration is present; that means the bucket is already configured and the
command can be skipped. `neon deploy` writes the branch's AWS-standard
credentials into the ignored `.env.local`. Map them to Render without copying
the secret values into chat or source control:

| Render key | Value |
| --- | --- |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `AWS_ENDPOINT_URL_S3` from `.env.local` |
| `S3_BUCKET` | `uploads` |
| `S3_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` from `.env.local` |
| `S3_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` from `.env.local` |
| `S3_REGION` | `AWS_REGION` from `.env.local` (`us-east-2`) |
| `S3_FORCE_PATH_STYLE` | `true` (Neon requires path-style addressing) |

Verify a real round trip locally (upload, list, read back, and assert the text):

```bash
node --env-file=.env.local scripts/verify-neon-upload.mjs
```

The script prints only the object key, size, content type and file contents —
never the credentials.

### Hosted demo seed (one-time manual)

The four synthetic demo logins are not created by normal startup. To seed them
once on Render:

1. In **zclear-api → Environment**, set `HOSTED_DEMO_PASSWORD` to a unique
   value of at least 12 characters. Do not put it in the repo or chat.
2. Run a one-off job against the latest successful API deployment so migrations
   are already current. Free web services have no dashboard shell or SSH, so
   use the Render API:

   ```bash
   curl --request POST 'https://api.render.com/v1/services/<service-id>/jobs' \
     --header 'Authorization: Bearer <render-api-key>' \
     --header 'Content-Type: application/json' \
     --data-raw '{"startCommand":"corepack pnpm --filter @zclear/api db:seed:hosted"}'
   ```

   The job inherits the API's built artifact and environment, including
   `HOSTED_DEMO_PASSWORD`. Its log prints the four synthetic emails but never
   the password. Avoid putting a real API key in shell history; use a secret
   manager or paste the command carefully. Track the job with the Render
   dashboard's **One-Off Jobs** page or the Render API.

Normal startup never seeds demo data; there is no `HOSTED_DEMO_SEED_ONCE` flag.
The seed upserts the fixed synthetic tenant, logins, shipment and invoice, and
refuses any password shorter than 12 characters. It is idempotent, but running
the job again resets the demo rows.

## 3. Create the Blueprint

1. Render Dashboard → **New +** → **Blueprint** → connect `mwemmz/z-clear`
   (Render needs access to the private repo) → branch `master`.
2. Render reads `render.yaml` and prompts for each `sync: false` variable. Set:
   - `DATABASE_URL` — Neon URL for `zclear_app`
   - `DATABASE_MIGRATION_URL` — Neon URL for `zclear_migrator`
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
3. `AUTH_JWT_SECRET` is generated by Render (no secret in source control).
4. Confirm the API plan is **free** (`plan: free`). Render's `preDeployCommand`
   is paid-only, so `startCommand` runs `db:migrate` then `db:grant` before the
   API boots. `node-pg-migrate up` is idempotent, so this is safe on every cold
   start; new tables still get least-privilege grants and RLS stays enforced.
   The static site is free by default and has no compute plan. No database is
   declared in the Blueprint — Neon supplies both connection strings.
5. The build and start commands use `corepack pnpm`, not `corepack enable`.
   Render's `/usr/bin` is read-only, so `corepack enable` fails when it tries to
   replace the `pnpm` shim. `corepack pnpm` honours the `packageManager` version
   in `package.json` without writing system links.

## 4. Build and verify

- API build: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @zclear/api... build`.
- API start: `db:migrate && db:grant && API_PORT="$PORT" corepack pnpm --filter @zclear/api start`
  (Render injects `PORT`; the app reads `API_PORT`). Expect a cold-start delay on
  the free plan after inactivity; the health check is at `/api/v1/health`.
- Web build: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @zclear/web... build`.
- Web output: `apps/web/dist` (this is why the Vercel build failed: it looked
  for `public/`).
- `GET https://<api-host>/api/v1/health` must return `status: "ok"`.
- Sign in from the deployed web URL and confirm the case-file header loads.

The web app receives the API's public URL as `VITE_API_ORIGIN` at **build
time** (Render derives it from the API service). If you add custom domains,
override `VITE_API_ORIGIN` on the web service and `CORS_ALLOWLIST` /
`WEB_BASE_URL` on the API service, then redeploy both. Changing a `VITE_`
variable requires a rebuild, not just a restart.

## 5. Demo data

`apps/api/src/scripts/seed-review-demo.ts` refuses to run with
`NODE_ENV=production`. For a demo, point a local run at a **separate synthetic
Neon database or branch**, with `NODE_ENV` unset, then use that database for a
preview deployment. Never seed real customer or customs data.

## 6. Guardrails

- No ASYCUDA integration, scraping or automation; `integrations/` stays empty.
- SMS/WhatsApp notification providers fail closed. `NOTIFICATION_PROVIDER=sms_mock`
  records outcomes in the outbox and sends nothing (local interface only). Email
  is off by default (`NOTIFICATION_PROVIDER=mock`); enable it only with a sender
  and webhook.
- The refresh cookie uses `SameSite=lax`. The current web flow uses bearer
  tokens from sign-in, not cross-site refresh, so this is safe today; a future
  cross-domain refresh flow needs a different design.
- Compliance estimates refuse unless `COMPLIANCE_RULES_FILE` supplies a
  `VERIFIED` rule with source URL and effective date. `COMPLIANCE_SAMPLE_MODE`
  is demo-only and every result is labelled do-not-pay-or-file. No tariff rate,
  duty or fee is stored in code.
- No AI model is called at runtime. `FEATURE_AI` is off by default and has a
  deterministic fallback; disclosure is in `docs/ai-safety.md`.
- No secrets or real data in `render.yaml`, commits or logs.
