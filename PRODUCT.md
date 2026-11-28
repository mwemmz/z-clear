# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users, inferred from `AGENTS.md`, `docs/demo-accounts.md`, and the implemented role screens:

- Importers and client viewers checking one current case, documents, review status, and plain-language stage updates on a phone.
- Clearing-agent staff working a case queue, review inbox, invoice/payment capture, driver assignment, and handoff export; desktop-first but expected to remain phone-usable.
- Platform admins setting up tenants, users, and curated configuration.
- Drivers with deliberately narrow access to an assigned shipment and manual check-in only.

The site is used in Zambia around customs clearance work, often on phones and tolerant of slow networks. Users need to know what is real and what is only a mock or sample.

## Product Purpose

Z Clear is the workflow around customs: documents, client updates, quotes, invoicing, history, and a one-way handoff export. It does not replace, scrape, automate, or claim live status from ASYCUDA World. Customs assessment and release happen in ASYCUDA; stage updates in Z Clear are manual.

Success means an importer can understand the current case and next action without guessing, an agent can move work forward without leaving the workflow, and nobody mistakes sample figures or mock channels for official ZRA data.

## Positioning

A trust-first, phone-first case workflow built around a manual stage record, with an explicit boundary to ASYCUDA and clear labels for real versus mock activity. The differentiator is honest workflow context, not customs automation or invented official status.

## Operating Context

Confirmed from `AGENTS.md` and repository docs:

- Customs stages are updated manually, one tap at a time, by agency staff.
- Our value is documents, client updates, quotes, invoicing, history, and a one-way handoff export into ASYCUDA.
- No integration with, scraping of, or automation of ASYCUDA World; no work under `integrations/` for ASYCUDA/ZRA without explicit approval.
- Real vs mock data is always labelled. Mocks say “Mock-up, sample data” and “Sample, not ZRA figures”.
- Money is integer minor units plus ISO currency, ZMW by default and USD on quotes.
- Stage labels, checklists, fees, and export mappings are versioned configuration, not code constants.

## Capabilities and Constraints

Confirmed from `AGENTS.md` and the current implementation:

- TypeScript, NestJS API (`apps/api`), React + Vite client (`apps/web`), shared domain package (`packages/shared`).
- Versioned REST under `/api/v1`; no API contract changes for UI work.
- Three complete themes: `light`, `dark`, `cocoa`. Raw colour values live only in `apps/web/src/styles/tokens.css`; components consume semantic tokens.
- Theme default follows `prefers-color-scheme`, choice is remembered in `localStorage`, applied before first paint, and switchers stay in sync.
- Touch targets are at least 44px; focus, hover, pressed, disabled, loading, and error states are explicit.
- English first, with strings structured for future Bemba/Nyanja; no invented duty, tax, or customs figures.
- Append-only audit and shipment-event records, tenant lookups by `(tenant_id, id)`, shared schema with RLS.
- A clearly labelled in-memory Sample workspace is available from sign-in: the four demo-role cards and five role buttons open synthetic roles with no credentials. It mirrors `/api/v1` shapes, sends no network requests, keeps state while roles are switched, offers a one-tap reset, and is the reachable home for the review decision, stage actions, invoices/payments and driver check-in.
- Points and referrals exist only as versioned, read-only structure. No earning values, redemption rules, expiry, rewards or incentives are supplied; balances read “Not available” while rules are unverified. A side panel exposes the structure and a denied state for drivers; the desktop rail and phone drawer share one navigation model.
- Static workflow mock screens remain behind an explicit disclosure. Their action buttons are disabled and labelled as layout-only previews; they never imply a real check-in, sign-up or Zamtel payment.
- Dev-only `/design` gallery shows component and state matrices; it must stay out of production bundles. The theme screenshot harness is also dev-only and accepts same-origin relative targets only.
- Bundle growth is budgeted near 40 KB gzipped over the earlier baseline. Measured 2026-11-28 after the loyalty/shell pass: 138.64 kB gzip JS vs 106.07 kB baseline (+32.57 kB); no map library and no autoplay video.

## Brand Commitments

- Product name: Z Clear.
- No supplied logo, photography, or brand illustration in the repository; do not invent official-looking marks or ZRA endorsement.
- Voice is plain, operational, and honest. Labels name the action; errors name the problem and the recovery.

## Evidence on Hand

- `AGENTS.md`: product boundary, stack, conventions, validation gate, and definition of done.
- `docs/demo-accounts.md`: four seeded demo logins plus the credential-free Sample workspace and its five synthetic roles.
- `docs/ui-redesign-plan.md`, `docs/api/ui-redesign-notes.md`, `ARCHITECTURE.md`, `SECURITY.md`.
- `docs/ui-redesign-screenshots/`: 43 prior captures across screens, viewports, and themes.
- Existing UI under `apps/web/src/screens`, `apps/web/src/ui`, `apps/web/src/mockups`, and `apps/web/src/styles`.

No real customer data, official ZRA figures, or new commercial claims are available; none may be fabricated.

## Product Principles

- Never imply live ASYCUDA status or official customs assessment.
- Give each role one clear current task and one primary action.
- Design for phones first, then keep dense staff views usable on desktop.
- Treat labels, fees, checklists, and export mappings as data.
- Label sample data unmistakably and refuse to guess regulated figures.

## Accessibility & Inclusion

- WCAG AA contrast for text and controls across all three themes.
- 44px minimum interactive targets and visible keyboard focus.
- `prefers-reduced-motion` honoured; motion communicates state only.
- Plain English now, with string structure ready for Bemba and Nyanja later.
