# Demo accounts

The four prototype logins are **local-only, synthetic accounts** created by
`apps/api/src/scripts/seed-review-demo.ts`. They do not exist on Render and must
never be seeded in production. The seed refuses to run when `NODE_ENV=production`.

Set `DEMO_PASSWORD=replace-with-local-demo-only-password` in your local `.env`
before seeding (see `.env.example`). The same password is hashed for every demo
user; the login page does **not** contain emails, passwords or autofill values.

| Demo role | Email | API role | What it can show |
|---|---|---|---|
| Clearing agent | `agent@demo-clearing.example` | `agent_staff` | Agency case file, review inbox, invoice/payment capture, driver assignment |
| Importer / client | `importer@kafuemetals.example` | `client_viewer` | Own case, checklist, approval, case status and valuation flow |
| Admin | `admin@demo-clearing.example` | `platform_admin` | Full tenant-scoped access for setup and support |
| Driver | `driver@demo-clearing.example` | `driver` | Only the assigned shipment, with manual check-in; no invoices, reviews, files or exports |

An extra synthetic user, `other.importer@sunshine-trading.example`, is seeded
only to demonstrate that an unrelated importer cannot read another importer's
case. It is not one of the four demo logins.

All details are invented: `.example` domains, sample TPINs, sample phone numbers
and `DEMO-IMPORT-0001`. No real client, customs, payment, SIM or device data is
used. Customs assessment and release happen in ASYCUDA World; Z Clear never
integrates with, scrapes or replaces it.
