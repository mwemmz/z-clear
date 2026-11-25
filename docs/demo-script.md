# Demo script (under 5 minutes)

Total runtime: about **4 minutes 40 seconds**. Read the lines in order. Every
mock screen is announced aloud as "this screen is a mock-up". Stage directions
are in brackets and are not spoken.

---

**[0:00-0:15 — show the Z Clear sign-in at phone width; sign in as importer.]**

"Z Clear keeps a clearing agent and their importer client on one shipment
record. I'll show the handoff flow first. This part is real: the role badge and
case-file header come from the API. The flow screens that follow are mock-ups,
and I'll say so each time."

**[0:15-0:45 — importer picks an agent. This screen is a mock-up.]**

"The importer opens the agent directory and picks a clearing agent. **This screen
is a mock-up** — it uses sample data, not a live registry."

**[0:45-1:15 — agent sends a draft. This screen is a mock-up.]**

"The agent prepares a draft declaration and sends it to the importer for
review. **This screen is a mock-up** — no submission is sent to ZRA."

**[1:15-1:50 — Draft check flags the quantity. This screen is a mock-up.]**

"The draft check flags a quantity mismatch before anything is filed. **This
screen is a mock-up** — the check is sample data, not a real customs
validation."

**[1:50-2:15 — importer queries. This screen is a mock-up.]**

"The importer queries the mismatch and asks the agent to confirm the cargo
details. **This screen is a mock-up** — it is an illustrative conversation
thread."

**[2:15-2:50 — agent corrects. This screen is a mock-up.]**

"The agent corrects the quantity and re-sends the draft. **This screen is a
mock-up** — the underlying shipment and document records in Z Clear are real,
but this edit screen is not."

**[2:50-3:20 — importer approves. This screen is a mock-up.]**

"The importer approves the corrected draft. **This screen is a mock-up** — no
approval is transmitted to ASYCUDA World."

**[3:20-4:20 — points update. This screen is a mock-up.]**

"The agent's service points update on the directory card. **This screen is a
mock-up.** What is real behind this flow is the case file: one shipment record,
a manual one-tap stage pipeline, documents, quotes and invoices, and a
read-only stage history. We do not integrate with ASYCUDA — customs itself
happens there."

**[4:20-4:40 — 20-second roadmap close; show docs/roadmap.md.]**

"Roadmap, not built: a one-way ASYCUDA handoff export; Cross truck check-in and
a border-ready flag; cell-tower tracking, which needs legal authority and
driver consent; Deliver forecasts from aggregate, approved ZRA data; Zamtel
Money payments; local languages; and real SIM verification. Every one is
roadmap, not built. Z Clear is the workflow around customs, not a replacement
for it."

---

## Rules for the recording

- Keep the video 5 minutes or less; this script targets 4:40.
- Audio must be audible with no background noise.
- Say "this screen is a mock-up" on all seven mock screens above.
- Do not say "integrated", "live" or "real-time" about any mock or roadmap item.
- If a fallback mock is used (Dev 1's work not ready by Friday midday), it must
  carry the `Mock-up, sample data` label on screen as well.
