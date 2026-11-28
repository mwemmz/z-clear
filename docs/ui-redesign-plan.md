# Z Clear UI redesign plan

Reading this as: a trust-first, phone-first workflow redesign for importers, agents and drivers, with a calm civic-service language, leaning toward native CSS tokens + Phosphor icons + one memorable case stage track.

Skills used: `emil-design-eng` for motion and polish, and `design-taste-frontend` as the single art-direction skill. No other art-direction skill is stacked.

Dials: `DESIGN_VARIANCE 5` (quiet GitHub/Primer-influenced Operate console, one shared navigation model), `MOTION_INTENSITY 3` (press feedback, drawer/panel entrance and the stage-track change only), `VISUAL_DENSITY 5` (phone-first but information-rich for agents).

## Design system

- **Type**: one family, `system-ui`, with `-apple-system`, `Segoe UI`, Roboto and sans-serif fallbacks. No web font download. Scale: `12/13/14/16/18/22/28px` with line heights `1.25` for titles and `1.5` for body. Case IDs, revision numbers and kwacha figures use the system monospace fallback for alignment.
- **Spacing**: 4px base. `4, 8, 12, 16, 20, 24, 32, 48`. Minimum tap target 44px. Safe-area insets respected on the bottom nav and sheets.
- **Radius**: documented shape rule, not uniform cards. Main CTA pill (`999px`); secondary controls and inputs `14px`; surfaces and sheets `18px`; icon buttons `44px` circular. This avoids the “identical rounded cards everywhere” tell.
- **Elevation**: surfaces are flat with `1px` semantic borders. Only the centre `+ New case` control and the open sheet use a tinted `--shadow-raised`. No gradient washes.
- **Colour**: exactly the three supplied palettes in `apps/web/src/styles/tokens.css`. Components consume semantic variables only. Cocoa Sky keeps brown for text/structure/primary, cream as canvas, powder blue as a **fill** with brown text and a border always present.
- **Icons**: `@phosphor-icons/react` outline at rest, fill for active navigation; named imports only; sizes `16/20/24`; `@tabler/icons-react` only for the few logistics glyphs Phosphor lacks (for example route/check-in). Every icon-only button has an `aria-label`.
- **Motion**: CSS tokens `--dur-press 100ms`, `--dur-enter 200ms`, `--dur-exit 140ms`, `--ease-out`, `--ease-in-out`, plus `--sheet-spring` and one exported spring config for sheets. Transform and opacity only. One orchestrated moment: the stage track advancing after a state change. No first-paint animation except the page-load mark. `prefers-reduced-motion` gets an instant equivalent.

## Anti-generic check

Initial idea: three-column case dashboard with identical cards. Revised: the memorable element is a **stage track** with a raised current node, a connecting progress line and a small “last update” note; surrounding content uses divided rows, not repeated cards. Cocoa Sky uses powder blue only as selected fill, never as blue text or an unbordered boundary. Mocks are explicitly labelled and use sample-only figures.

Navigation was then quieted: one shared model renders a sticky desktop rail and a phone hamburger drawer, replacing duplicated in-page rails and the floating bottom bar. Points and referrals open as a secondary right-side panel with only verified structure; no earning or reward claim is made.

## Wireframes

### 1. Importer home (360px)

```text
┌──────────────────────────────┐
│ Z Clear        [theme] [∞]   │
│ Good morning, importer       │
│ ┌ current case ────────────┐ │
│ │ ZCLR-2041   Kafu Metals  │ │
│ │ ○──●──○──○  Review       │ │
│ │ 2h since last update     │ │
│ └──────────────────────────┘ │
│ ┌ action needed ───────────┐ │
│ │ Review valuation draft   │ │
│ └──────────────────────────┘ │
│ Recent cases                │
│ ZCLR-2040  Cleared  •••     │
│ ZCLR-2038  Query    •••     │
│        [⌂] [▤] ( + ) [◎] [☻]│
└──────────────────────────────┘
```

### 2. Case detail bottom sheet (360px)

```text
┌──────────────────────────────┐
│ remaining page scrim         │
│ ╭──────────────────────────╮ │
│ │ ZCLR-2041        [close] │ │
│ │ ○──●──○──○ Review draft  │ │
│ │ Route: Ndola → Lusaka    │ │
│ │ Documents   6/7  ◔       │ │
│ │ [Info][Documents][Review]│ │
│ │ [Payments]               │ │
│ │ [Call agent] [Message]   │ │
│ ╰──────────────────────────╯ │
└──────────────────────────────┘
```

### 3. Review (360px)

```text
┌──────────────────────────────┐
│ ← Review draft    Revision 3 │
│ ┌ draft check ─────────────┐ │
│ │ Field: declared value    │ │
│ │ Draft K 12,400           │ │
│ │ Source K 12,000          │ │
│ │ Plain-language note      │ │
│ └──────────────────────────┘ │
│ [⚠ Query]   [✓ Approve]     │
│ [✓ Clear Points]             │
└──────────────────────────────┘
```

### 4. Agent directory (360px)

```text
┌──────────────────────────────┐
│ Find an agent                │
│ [All][Nearby][Fast queries]  │
│ ┌──────────────────────────┐ │
│ │ Chanda Clearing          │ │
│ │ 42 pts · 18 shipments    │ │
│ │ Queries fixed in ~2h     │ │
│ │          [Choose]        │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 5. Agent workspace (1280px)

```text
┌────────┬───────────────┬────────────────────────┐
│ sidebar│ case list     │ detail                 │
│ Z Clear│ [Priority][All]│ ZCLR-2041   ○─●─○─○    │
│ Home   │ ▸ 2041 review  │ [Info][Docs][Review]   │
│ Cases  │ ▸ 2040 cleared │ [Payments]             │
│ Drivers│ ▸ 2038 query   │ Send draft / Revise    │
│ Mocks  │               │ Ready for ASYCUDA      │
│ Theme  │               │ (manual filing)        │
└────────┴───────────────┴────────────────────────┘
```

### Mock strip

```text
USSD-lite (feature phone) | SMS thread | Driver check-in | Outage banner | Cost check
All wrapped in MockScreen with “Mock-up, sample data”; figures say “Sample, not ZRA figures”.
```

## Delivery phases

1. Tokens, theme switcher, pre-paint script, Button/Icon/Status/StatePanel primitives and contrast tests.
2. Importer screens and stage track, wired to the existing API/client data shapes.
3. Agent workspace and shared detail tabs/review flow.
4. Mocks, `/design` gallery, docs and screenshot/contrast/bundle verification.

No API contracts change. Real data remains labelled real; mocks remain labelled mock. Duty, VAT and fee figures remain sample-only and `NEEDS_VERIFICATION` where applicable.

## Verification

`pnpm verify` passes. Web JS grew from `106.07 kB` gzip before the redesign to
`138.64 kB` after the loyalty/shell pass, an increase of `32.57 kB` gzip, below
the `~40 kB` budget. The
dev-only gallery is tree-shaken from the production build. Screenshots for every preview
screen at `360x800` and `1280x900` in all three themes are in
`docs/ui-redesign-screenshots`; the capture manifest records zero overflow,
undersized controls, unlabelled icon buttons and clipped text. The stage-track
animation was checked at 4x CPU throttling and disabled under reduced motion.
