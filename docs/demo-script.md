# Demo script (under 5 minutes)

Total runtime: about **4 minutes 40 seconds**. Read the lines in order. Every
mock screen is announced aloud as "this screen is a mock-up". Stage directions
are in brackets and are not spoken.

---

**[0:00-0:15 — show the Z Clear sign-in at phone width; sign in as importer.]**

"Z Clear keeps a clearing agent and their importer client on one shipment
record. I'll show the review flow first. The role badge and case-file header are
real, from the API. Only the cards I explicitly call out are mock-ups."

**[0:15-0:40 — importer picks an agent. Show the mock directory card.]**

"The importer opens the agent directory and picks a clearing agent. **This screen
is a mock-up** — it uses sample data, not a live registry."

**[0:40-1:15 — agent sends a draft. Show the real review summary from the API.]**

"The agent sends the shipment details for review. This is the real API: it
creates a review revision, runs a deterministic draft check and records an
append-only points entry. Nothing is sent to ZRA — customs happens in ASYCUDA
World."

**[1:15-1:45 — Draft check flags the quantity. Show the real draftFindings.]**

"The draft check flags a quantity mismatch before anything is filed. This is
real code in the API, not a customs validation. A blocked draft stays a draft:
nothing was sent and no points are earned."

**[1:45-2:15 — importer queries. Show the real query response.]**

"The importer queries the mismatch and asks the agent to confirm the cargo
details. This is a real, tenant-scoped API call with an audit entry."

**[2:15-2:45 — agent corrects. Show the real revise then send response.]**

"The agent corrects the quantity and raises a new revision. Material edits bump
review freshness, so a stale approval is rejected. This is real."

**[2:45-3:15 — importer approves. Show the real approval response.]**

"The importer approves the exact revision. This is real: one append-only points
entry is written per earned event. No approval is transmitted to ASYCUDA World."

**[3:15-4:00 — points / directory card. Show the mock card; mention the API extras.]**

"The points ledger is real in the API. **This screen is a mock-up** — the
directory card showing the rating line is sample data. Behind the flow is one
case file with a manual one-tap stage pipeline, documents, quotes and invoices.
We also added a one-way handoff artifact for an agent to key into ASYCUDA by
hand, an invoice PDF snapshot, and an append-only notification outbox with the
email provider off by default. We do not integrate with ASYCUDA."

**[4:00-4:20 — 20-second roadmap close; show docs/roadmap.md.]**

"Roadmap, not built: a polished downloadable handoff file and review UI; Cross
truck check-in and a border-ready flag; cell-tower tracking, which needs legal
authority and driver consent; Deliver forecasts from aggregate, approved ZRA
data; Zamtel Money payments; local languages; and real SIM verification. Every
one is roadmap, not built. Z Clear is the workflow around customs, not a
replacement for it."

---

## Rules for the recording

- Keep the video 5 minutes or less; this script targets 4:40.
- Audio must be audible with no background noise.
- Say "this screen is a mock-up" on every mock screen shown (the directory and
  points card above, and any of the six static screens from the MOCKUPS toggle).
- Do not say "integrated", "live" or "real-time" about any mock or roadmap item.
- If a fallback mock is used (Dev 1's work not ready by Friday midday), it must
  carry the `Mock-up, sample data` label on screen as well.
