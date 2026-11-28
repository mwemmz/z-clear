# Demo accounts

The four prototype logins are **synthetic accounts** created by
`apps/api/src/scripts/seed-review-demo.ts`. Locally they use `DEMO_PASSWORD`;
the hosted demo uses a separate `HOSTED_DEMO_PASSWORD` seeded once on first
deploy. The login page does **not** contain emails, passwords or autofill
values.

For local seeding, set `DEMO_PASSWORD=replace-with-local-demo-only-password`
in your local `.env` before seeding (see `.env.example`). The default seed
refuses to run when `NODE_ENV=production`; hosted seeding uses the explicit
`--hosted` mode described below.

| Demo role | Email | API role | What it can show |
|---|---|---|---|
| Clearing agent | `agent@demo-clearing.example` | `agent_staff` | Agency case file, review inbox, invoice/payment capture, driver assignment |
| Importer / client | `importer@kafuemetals.example` | `client_viewer` | Own case, checklist, approval, case status and valuation flow |
| Admin | `admin@demo-clearing.example` | `platform_admin` | Full tenant-scoped access for setup and support |
| Driver | `driver@demo-clearing.example` | `driver` | Only the assigned shipment, with manual check-in; no invoices, reviews, files or exports |

## Hosted demo login (seeded once on first deploy)

The same four synthetic logins are created on Render by the first deployment:

1. Set `HOSTED_DEMO_PASSWORD` (at least 12 characters) in
   **Render → zclear-api → Environment**. Never reuse a real password.
   `HOSTED_DEMO_SEED_ONCE=true` is already in `render.yaml`, so no shell or
   one-off job is needed.
2. Push to `master`. The API starts with `db:migrate → db:grant → hosted seed`,
   then serves requests. The first boot creates the synthetic tenant, users,
   shipment and invoice.
3. Sign in at the Render web URL with the same emails listed above and the
   `HOSTED_DEMO_PASSWORD` value.

Later deploys skip the seed because `demo_seed_state` records a tenant-owned
marker, so changes made during a demo persist. A deliberate reset requires
bumping `HOSTED_SEED_VERSION` in `seed-review-demo.ts` and deploying that change;
see `docs/render-deploy.md`.

An extra synthetic user, `other.importer@sunshine-trading.example`, is seeded
only to demonstrate that an unrelated importer cannot read another importer's
case. It is not one of the four demo logins.

All details are invented: `.example` domains, sample TPINs, sample phone numbers
and `DEMO-IMPORT-0001`. No real client, customs, payment, SIM or device data is
used. Customs assessment and release happen in ASYCUDA World; Z Clear never
integrates with, scrapes or replaces it.
