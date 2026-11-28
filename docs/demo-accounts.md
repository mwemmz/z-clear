# Demo accounts

The four prototype logins are **synthetic accounts** created by
`apps/api/src/scripts/seed-review-demo.ts`. Locally they use `DEMO_PASSWORD`;
the hosted demo uses a separate `HOSTED_DEMO_PASSWORD` seeded once on first
deploy. The login page does **not** contain emails, passwords or autofill
values.

## Sample workspace (no credentials)

The sign-in guide also offers a **Sample workspace**. Choose a role button to
open an in-memory workspace immediately; no email, password, account creation
or network request is involved. Five synthetic roles are available: agency
owner, clearing agent, importer/client, platform admin and driver. The header
shows a “Sample data” badge, a role switcher and a reset control. State carries
across role switches so an importer query can be answered by the agency, and
reset restores the seeded cases. Sample identities use `.invalid` addresses
only inside the app; no credentials are shown. Nothing in this workspace is
filed with ZRA or ASYCUDA.

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

The same four synthetic logins are created on Render after the password is set:

1. Set `HOSTED_DEMO_PASSWORD` (at least 12 characters) in
   **Render → zclear-api → Environment**. Never reuse a real password.
   `HOSTED_DEMO_SEED_ONCE=true` is already in `render.yaml`, so no shell or
   one-off job is needed.
2. Restart the API (or push to `master`). The API starts with
   `db:migrate → db:grant → hosted seed`, then serves requests. The first
   seeded boot creates the synthetic tenant, users, shipment and invoice. If
   the password is missing, the seed is skipped and the API still boots.
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
