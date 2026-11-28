# UI redesign screenshots

Captured from the Vite dev server at `/design` with headless Chrome.

- Seven preview screens: `importer`, `case`, `review`, `agents`,
  `agent-workspace`, `mocks`, `profile`.
- Two viewports: `360x800` (mobile) and `1280x900` (desktop).
- Three themes: `light`, `dark`, `cocoa`.
- One extra gallery capture shows the three theme columns side by side.

`manifest.json` records each URL and the layout diagnostics collected at capture
time. The final pass reports zero horizontal overflow, zero undersized tap
targets, zero unlabelled icon buttons and zero clipped text on every screen.

The stage-track animation was sampled with Chrome's CPU throttling set to 4x:
33 frames in 500 ms, 17 ms average and maximum frame gap. With
`prefers-reduced-motion: reduce`, the animation duration is effectively zero and
no animations are active.
