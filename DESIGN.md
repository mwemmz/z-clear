---
name: Z Clear
description: A calm, manual case-operations console for Zambian clearing workflows
colors:
  canvas: "#f6f8fa"
  surface: "#ffffff"
  border: "#d0d7de"
  ink: "#1f2328"
  muted-ink: "#59636e"
  blue-accent: "#0969da"
  blue-fill: "#ddf4ff"
  success: "#1a7f37"
  warning: "#9a6700"
  danger: "#cf222e"
  cocoa-canvas: "#f6eedf"
  cocoa-ink: "#3b2a20"
  powder-blue: "#bfd9ec"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  control: "6px"
  surface: "8px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.blue-accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.surface}"
    padding: "16px"
  status-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: Z Clear

## Overview

**Creative North Star: "The Case Ledger"**

Z Clear is a case console, not a marketing page and not a gallery of equal cards. It takes its cues from dense, calm operations tools: a clear page title, hairline-separated rows, a small reserved accent, and one dominant next action. The screen earns trust by showing the case reference, the manual stage record, and the source of each fact before it offers anything decorative.

The visual system is deliberately quiet. Neutral surfaces and compact type carry the work; colour appears only where it encodes state or invites the single permitted action. Motion is one stage-advance moment plus small press feedback, never a flourish. Status is never colour alone: text labels, icons and provenance marks carry the meaning when colour is removed.

Three themes share the same semantic token names. `light` and `dark` are neutral GitHub/Primer-influenced console palettes. `cocoa` keeps brown for text, structure and primary actions, a cream canvas, and powder blue only as a fill with brown text and a visible border.

**Key Characteristics:**

- Case-first hierarchy: reference and next action are read before anything else.
- Compact, aligned rows with 44px touch targets and small 6px/8px radii.
- Hairline borders, flat surfaces, and shadows reserved for real overlays.
- Explicit provenance: every stage says it is a manual agency record, never live ZRA status.
- One primary action per view; every other control is visibly secondary or informational.

## Colors

The palette is semantic and theme-scoped. Raw colour values live only in `apps/web/src/styles/tokens.css`; components consume `--primary`, `--surface`, `--text`, `--border` and their companions.

### Primary

- **Blue Accent** (#0969da): The reserved action and selection colour in `light`. It marks the single primary button, the current stage node, focus rings and selected list rows. In `dark` the same role becomes #4493f8 with dark text on the fill.
- **Blue Fill** (#ddf4ff): A quiet informational fill for the action strip, active filters and selected navigation. It always pairs with the accent-coloured text and a visible border.

### Secondary

- **Powder Blue Fill** (#bfd9ec): In `cocoa` only, this is a fill behind brown text with a visible #8a7357 border. It is never used as a text colour or a primary action.
- **Cocoa Ink** (#3b2a20): The structural brown used for text, borders and primary actions in the cocoa theme; `cocoa-canvas` (#f6eedf) is the cream background.

### Neutral

- **Canvas** (#f6f8fa): Page background in `light`; `surface` (#ffffff) is the raised row/card background.
- **Border** (#d0d7de): Hairline structure. `border-strong` (#8c959f) is reserved for controls that need a firmer edge.
- **Ink** (#1f2328) and **Muted Ink** (#59636e): Primary body text and supporting copy. Status text uses success, warning or danger only with an explicit label.
- **Success** (#1a7f37), **Warning** (#9a6700), **Danger** (#cf222e): State vocabulary. Each has a soft fill token and never appears alone as the state label.

### Named Rules

**The Reserved Accent Rule.** The primary accent is used on one action and one current-selection state per view. Its rarity is the point.

**The Powder-Blue Fill Rule.** In Cocoa Sky, powder blue is a fill with brown text and a visible border. It never becomes a link colour, a primary button, or a glow.

**The Provenance Rule.** A manual stage record always carries its source. No palette choice may make a manual update look like a live customs feed.

## Typography

**Display Font:** system-ui with Apple, Segoe UI and Roboto fallbacks.
**Body Font:** the same system stack; no remote font is loaded.
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, Consolas for references, amounts and compact metadata.

**Character:** Native, legible and unpretentious. The system stack keeps the console fast on slow phones and avoids a brand voice that competes with case facts.

### Hierarchy

- **Display** (650, 24px, 1.25): App title and rare page-level emphasis.
- **Title** (650, 20px, 1.25): Section headings such as “Case file” and “Review draft”.
- **Body** (400, 14px, 1.5): Default copy; keep paragraphs short and left aligned.
- **Label** (600, 13px, 1.5): Buttons, pills, metadata labels and uppercase eyebrows.
- **Mono** (600, 14px, 1.5): Case references, money, revision numbers and stage timestamps.

### Named Rules

**The Compact Voice Rule.** Use 13px for labels and 14px for body copy; never shrink below 12px and never substitute large type for hierarchy.

## Layout

Mobile first and single column. A sticky, compact app bar holds the brand, role, hamburger, points/referrals trigger and account menu. The current case block places the reference first, then the stage track, then a short fact row, then one primary action. The hamburger opens a 44px-target drawer with one shared navigation model; the previously floating bottom bar is hidden while the shell is active so the case stays first.

At 1280px the shell becomes a console: a quiet 12rem left rail carries Home, Cases, Agents (importers only), Profile and a low-emphasis points/referrals link. The agent workspace uses a 20rem case queue and a flexible detail column; its old in-page sidebar and the importer's duplicate bottom bar are suppressed. The importer home keeps a compact side rail for the next action while the case block and recent cases stay in the main column.

Spacing uses a 4px base rhythm: 4, 8, 12, 16, 20, 24, 32 and 48px. Rows are separated by 1px borders rather than nested cards. Content never exceeds 72rem for standard screens or 88rem for the agent workspace.

## Elevation & Depth

The system is flat by default. One-pixel borders and subtle surface fills convey hierarchy; shadows appear only for the account menu, phone drawer, case-sheet and points/referrals dialogs. There are no glows, gradient backgrounds or decorative layers.

### Shadow Vocabulary

- **Raised** (`0 8px 24px rgba(...)`): The new-case button when it floats above content.
- **Overlay** (`0 12px 32px rgba(...)`): Account menu, phone drawer, and the native case-sheet and points/referrals dialogs.

### Named Rules

**The Flat-By-Default Rule.** A surface is flat at rest. Depth is reserved for elements that genuinely sit above the page.

## Shapes

Small radii only: 6px for controls, 8px for surfaces, and 999px for pills and stage nodes. Borders are hairlines. Status panels use full 1px borders and soft fills; no thick side-tab accents. The sheet uses a 12px top radius because it is a mobile overlay, not a content card.

## Components

### Buttons

- **Shape:** 6px radius, 44px minimum height, 8px/12px horizontal padding.
- **Primary:** Accent background with the theme's on-primary text. One per view.
- **Secondary / Ghost:** Surface or transparent background, bordered or quiet, never competing with the primary.
- **States:** Hover darkens or tints the surface; focus uses a 2px focus ring with 2px offset; loading hides the label behind a spinner; success briefly shows a check.

### Status Pills

- **Style:** Small bordered label with a soft fill for success, warning, danger or information.
- **State:** Text always names the state; colour is reinforcement only.

### Current Case Card

- **Shape:** Bordered surface with a small radius and a hairline fact row.
- **Content:** Reference, client, stage track, source/freshness metadata and one primary action.
- **State:** The active case uses a border-colour change, not a thick coloured tab.

### Stage Track

- **Shape:** Seven evenly spaced nodes over a 2px rail; the current node is larger and uses the accent fill.
- **Motion:** One 280ms scale advance when the stage actually changes; reduced motion removes it.
- **State:** On hold keeps every step unresolved and shows an explicit warning caption.

### Case Sheet

- **Shape:** Native dialog bottom sheet, 12px top corners, sticky header, divided tab strip.
- **Content:** Stage track, readiness (or an honest “not in feed” message), four labelled sections, and provenance.
- **Behaviour:** Tabs change the panel content; where a real case section exists, the panel offers a shortcut that closes the sheet, scrolls to that section and moves focus there. Close waits 120ms so the exit transform can finish.

### Navigation

- **One model:** Home, Cases, Agents (importers only) and Profile are defined once and rendered by both the desktop rail and the phone drawer, with `aria-current` for the active view.
- **Mobile:** Header hamburger opens a left drawer over a scrim. It closes on backdrop click, Escape or a navigation choice, returns focus to the trigger, and uses 44px targets with 20px Phosphor icons.
- **Desktop:** A quiet sticky left rail replaces the in-page rails. Points & referrals sits at the foot as a ghost link, below the case navigation and its “Structure only · no verified rules yet” note.
- **Not a basket:** Points & referrals opens a secondary right-side panel, never a purchase/checkout flow.

### Points & Referrals Panel

- **Shape:** Native right-side dialog with a sticky header, scrim, compact fact rows and a short provenance line.
- **Content:** Versioned rules, an explicit “Not available” balance, empty-ledger copy and a referral structure note. No earning values, redemption rules, expiry, rewards or incentives appear.
- **States:** Loading, denied (drivers), error and unconfigured use the shared state panels and the same semantic tokens as the rest of the console.

### State Panels

- **Style:** Bordered panel with icon, title, one sentence of copy and an optional action.
- **Variants:** Loading, empty, error, denied and stale. Loading uses an opacity-pulsing skeleton; error and stale add semantic colour to the border and icon.

### Sample Workspace

- **Entry:** Four demo-role cards and five role buttons on sign-in open synthetic roles directly; no email, password or `@` on the unauthenticated screen.
- **Chrome:** A persistent “Sample data” badge, role switcher and reset control sit in the header beside the role/case context.
- **Data:** All records are synthetic and say so; the invoice is an agency service fee, not a ZRA assessment. The estimate still refuses with `no_verified_rule`.
- **Behaviour:** Sample tokens route the same `api` façade to in-memory state, so real screens, states and transitions stay reachable without a backend.

### Stage Action And Review Decision

- **Stage action:** One primary “Mark <stage>” button plus a secondary hold form. The note says it is a manual agency record and nothing was sent to ZRA.
- **Review decision:** The comparison screen is no longer gallery-only. An importer can query or approve an exact revision; the agency can send or revise. The provenance notice stays visible after approval.

## Do's and Don'ts

**Do:**

- Do use semantic tokens; the raw palette has exactly one source file.
- Do label status in words and marks, not colour alone.
- Do keep 44px targets and visible focus rings on every interactive control.
- Do mark sample data and mock screens unmistakably.
- Do say when a figure, checklist or licence status is unverified.

**Don't:**

- Don't present a manual stage as live ASYCUDA or ZRA status.
- Don't invent duty, tax or fee figures; refuse when no verified rule exists.
- Don't use thick side-tab accents, gradients, glows or decorative card galleries.
- Don't stack equal cards when one case and one action should lead.
- Don't add motion beyond the stage advance, press feedback and sheet exit.
