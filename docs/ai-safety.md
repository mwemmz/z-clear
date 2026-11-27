# AI safety and disclosure

## Runtime models and tools

**No AI model is called by Z Clear at runtime.** Both the importer-review
wording step (`WordingService`) and the compliance-assistant wording step
(`ComplianceWordingService`) are gated behind `FEATURE_AI` (off by default).
When the flag is on but no model is wired — the current state — they return
fixed, deterministic wording. Nothing in the application sends a request to a
model provider, and no provider API key exists in code, fixtures or
`render.yaml`.

These submission documents and the web scaffold were drafted with the
**OpenCode coding agent using the Big Pickle model**. That is a drafting tool,
not a runtime or product dependency. No customer or customs data was supplied
to it.

## What an AI step may and may not do

- It may reword text only. It never computes money, sets a rate, assesses duty,
  VAT or fees, decides compliance, or changes a verification status or source.
- It receives no tools and no network access. It sees only the text it is asked
  to reword — no other tenants, no other shipments, no personal data, no
  personal identifiers and no document contents.
- Its output is treated as untrusted text for display, never as instructions.
  A human confirms every review message before it is sent.
- Keys, if a provider is ever approved, come from environment variables; model
  and tool names must be disclosed here before enablement.

## Compliance estimator boundary

The estimator is pure and data-driven. Tariff rules come only from an external
JSON file configured by `COMPLIANCE_RULES_FILE`; each rule must carry a source
URL, effective date and verification status. The estimate helper uses only
`VERIFIED` rules. `NEEDS_VERIFICATION` and `SUPERSEDED` rules are refused.
`SAMPLE` rules are honoured only when `COMPLIANCE_SAMPLE_MODE=true`, and the UI
then labels the figure **SAMPLE — do not pay or file**.

Z Clear does not assess customs value, decide duty or tax, register a
declaration or decide release. Those happen in ASYCUDA World. `integrations/`
stays empty.

## Prompt injection posture

Uploaded documents and inbound messages are untrusted and may contain hidden
instructions. Any future model step would be text-only, tenant-scoped,
read-only and tool-free; model output would be displayed as data, never
executed. This is a guardrail for a future phase, not a built capability.
