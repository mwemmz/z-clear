# Roadmap (slide-only, not built)

Every item below is **Roadmap, not built**. These are discussion slides for the
challenge submission, not features in the prototype. Do not demonstrate them as
working software and do not claim they are integrated with any external system.

| Item | One line | Guardrail |
|---|---|---|
| Polished handoff file and review UI | Turn the existing one-way JSON artifact into a downloadable file with an agent review screen. | **Roadmap, not built.** The API artifact exists; no integration, scraping or automation of ASYCUDA; `integrations/` stays empty. |
| Cross (truck check-in, border-ready flag) | An agent-entered check-in and a border-ready indicator for a truck. | **Roadmap, not built.** Manual status only; no live border or ZRA feed and no claim of official status. |
| Cell-tower tracking | Optional location updates derived from cell-tower data. | **Roadmap, not built.** Needs legal authority and explicit driver consent before any design or data collection; nothing collected in the prototype. |
| Deliver (forecasts, trade indicators) | Aggregate arrival and trade indicators for planning. | **Roadmap, not built.** Needs ZRA data and approval; aggregate, consented data only, never individual consignments. |
| Zamtel Money integration | Pay a sample invoice from a mobile-money wallet. | **Roadmap, not built.** No provider integration or real payment credentials; any fee-payment screen is a labelled mock-up. |
| Local languages | Offer the staff flow in languages used by agents and clients. | **Roadmap, not built.** Native-speaker review required; no machine-generated translation presented as reviewed. |
| Real SIM verification | Verify a driver or contact number through a SIM/identity check. | **Roadmap, not built.** Needs regulatory authority and consent; no SIM, device or identity data in the prototype. |

## Presentation note

Read each row aloud as "Roadmap, not built" and keep the slide on screen for the
20-second roadmap close at the end of the demo. If a mock-up for any of these
exists in Dev 1's `mockups/` folder, label it `Mock-up, sample data` and say
aloud that the capability is not built.
