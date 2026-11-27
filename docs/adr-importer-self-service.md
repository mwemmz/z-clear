# ADR: importer cases before agent appointment

**Status:** Proposed (STEP 0 of the importer self-service build)  
**Date:** 2026-11-27  
**Context:** importers must create a case before they appoint an agent, but tenants are
per agency and all business tables are tenant-owned behind fail-closed RLS.

## Options considered

### (a) Importer personal tenant, then a consented share/copy into the agency tenant

The importer signs into their own tenant and creates the case there. On appointment,
either the case is copied into the agency tenant or a cross-tenant read grant is added.

- Reuses the existing login path: `auth_login_lookup(email)` is a `SECURITY DEFINER`
  lookup over the globally unique `users.email`, so no new identity system is needed.
- Cross-tenant *reads* would need a new privileged path and would weaken the current
  "all lookups are `(tenant_id, id)`" rule. A **copy** avoids that but creates two
  systems of record, plus a shadow importer user in the agency tenant (email is
  globally unique, so the same person cannot have two user rows with the same email).

### (b) Shared pre-appointment holding space

A global (non-tenant) table holds unassigned cases until appointment.

- RLS cannot protect a global table, so it would need its own access-control layer —
  more new security code than option (a).
- Still needs an importer identity and a hand-off into the agency tenant, so it does
  not remove the hard part; it just moves it.

## Decision

**Option (a) with a consented, audited *transfer* — not a copy and not a cross-tenant
read.** On appointment, a single narrowly-scoped `SECURITY DEFINER` function validates
the request and moves the importer's `users` row and their case into the chosen
agency's tenant inside one transaction.

This is the smallest option that keeps RLS intact because:

- after the transfer, every row involved lives in exactly one tenant, so **all
  existing services (reviews, documents, quotes, invoices, stage events) are
  unchanged**;
- there is no shadow identity, no mirrored status row, and no new cross-tenant
  data path — only the deliberately published, read-only agent directory;
- normal queries never gain a privileged way around `app.tenant_id`; the single
  privileged function is explicit, parameter-checked, and audited.

The transfer revokes the importer's current sessions; the same email and password
sign them back in with the agency tenant on the token.

## Constraints and guardrails

- Pre-appointment cases carry **typed consignment data only**. File uploads begin
  after appointment, so no object-storage keys need to move.
- The function accepts only `(case_id, agent_user_id, consent_text)`, checks that
  the case is unassigned and personal, that the agent is an active
  `agent_staff`/owner in an active agency tenant, and records consent plus audit
  entries in **both** tenants.
- A failed validation rolls the whole transfer back.
- Licence status stays `SIMULATED / unverified` until ZRA data exists, labelled
  `Simulated, pending ZRA API`.
- No duty, VAT, fee or legal figure is created by this flow.
