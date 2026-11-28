# Demo accounts

The four prototype logins are **synthetic accounts** created by
`apps/api/src/scripts/seed-review-demo.ts`. Locally they use `DEMO_PASSWORD`;
the hosted demo uses a separate `HOSTED_DEMO_PASSWORD` and an explicit one-time
operator seed. The login page does **not** contain emails, passwords or
autofill values.

For local seeding, set `DEMO_PASSWORD=replace-with-local-demo-only-password`
in your local `.env` before seeding (see `.env.example`). The default seed
refuses to run when `NODE_ENV=production`; hosted seeding requires the explicit
`--hosted` mode described below.

| Demo role | Email | API role | What it can show |
|---|---|---|---|
| Clearing agent | `agent@demo-clearing.example` | `agent_staff` | Agency case file, review inbox, invoice/payment capture, driver assignment |
| Importer / client | `importer@kafuemetals.example` | `client_viewer` | Own case, checklist, approval, case status and valuation flow |
| Admin | `admin@demo-clearing.example` | `platform_admin` | Full tenant-scoped access for setup and support |
| Driver | `driver@demo-clearing.example` | `driver` | Only the assigned shipment, with manual check-in; no invoices, reviews, files or exports |

## Hosted demo login (one-time manual seed)

The same four synthetic logins can be seeded once on Render. This is an
explicit operator action, not part of normal startup:

1. Set `HOSTED_DEMO_PASSWORD` (at least 12 characters) in
   **Render → zclear-api → Environment**. Never reuse a real password.
2. Run the hosted seed once using a Render one-off job against the latest
   successful API deployment (see `docs/render-deploy.md`).
3. Sign in at the Render web URL with the same emails listed above and the
   `HOSTED_DEMO_PASSWORD` value.

The hosted seed uses the same dedicated synthetic tenant and fixed `.example`
identities. There is no `HOSTED_DEMO_SEED_ONCE` flag and normal startup never
seeds demo data, so changes made during a demo persist until someone
deliberately runs the job again.

An extra synthetic user, `other.importer@sunshine-trading.example`, is seeded
only to demonstrate that an unrelated importer cannot read another importer's
case. It is not one of the four demo logins.

All details are invented: `.example` domains, sample TPINs, sample phone numbers
and `DEMO-IMPORT-0001`. No real client, customs, payment, SIM or device data is
used. Customs assessment and release happen in ASYCUDA World; Z Clear never
integrates with, scrapes or replaces it.
