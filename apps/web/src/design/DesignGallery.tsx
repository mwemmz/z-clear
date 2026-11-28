import { THEMES } from '../theme';
import { Mockups } from '../mockups';
import {
  AgentDirectoryMock,
  AgentWorkspace,
  CaseSheet,
  ImporterHome,
  ProfilePanel,
  ReviewScreen,
} from '../screens';
import { Button, StageTrack, StatePanel, StatusPill, ThemeSwitcher } from '../ui';
import type { StateVariant } from '../ui';
import type { StatusTone } from '../ui';

const STATES: StateVariant[] = ['loading', 'empty', 'error', 'denied', 'stale'];
const TONES: StatusTone[] = ['success', 'warning', 'danger', 'info', 'neutral'];
const SCREENS = [
  'importer',
  'case',
  'review',
  'agents',
  'agent-workspace',
  'mocks',
  'profile',
] as const;
type PreviewScreen = (typeof SCREENS)[number];

interface Props {
  screen?: string | null;
  state?: string | null;
}

const SAMPLE_CASES = [
  { id: 's1', reference: 'ZCLR-2041', stage: 'submitted' as const },
  { id: 's2', reference: 'ZCLR-2038', stage: 'in_transit' as const },
];

function asState(value?: string | null): StateVariant | undefined {
  return STATES.find((state) => state === value);
}

function asScreen(value?: string | null): PreviewScreen | undefined {
  return SCREENS.find((screen) => screen === value);
}

function ScreenPreview({ screen, state }: { screen: PreviewScreen; state?: StateVariant }) {
  switch (screen) {
    case 'importer':
      return (
        <ImporterHome
          reference="ZCLR-2041"
          clientName="Sample Importer Ltd"
          stage="submitted"
          updatedLabel="updated today"
          actionText="Check the review draft before it is filed in ASYCUDA."
          recentCases={[{ reference: 'ZCLR-2038', stage: 'in_transit' }]}
          onOpenCase={() => undefined}
          onNewCase={() => undefined}
          onAgents={() => undefined}
          onProfile={() => undefined}
          state={state}
        />
      );
    case 'case':
      return (
        <CaseSheet
          open
          onClose={() => undefined}
          reference="ZCLR-2041"
          route="Ndola → Kasumbalesa"
          stage="submitted"
          documentsReady={0}
          documentsTotal={0}
          state={state}
        >
          <p className="hint">Sample case detail. Live records stay behind the app login.</p>
        </CaseSheet>
      );
    case 'review':
      return (
        <ReviewScreen
          revision={3}
          field="Declared value"
          draftValue="K 12,400"
          sourceValue="K 12,000"
          message="The draft value may not match your records. Check before you approve."
          state={state}
          stale={state === 'stale'}
          onQuery={() => undefined}
          onApprove={() => undefined}
          onClearPoints={() => undefined}
        />
      );
    case 'agents':
      return <AgentDirectoryMock state={state} />;
    case 'agent-workspace':
      return (
        <AgentWorkspace cases={SAMPLE_CASES} activeId="s1" onSelect={() => undefined} state={state}>
          <section className="card">
            <h2>Case detail</h2>
            <StageTrack stage="submitted" />
            <p className="hint">Sample data only · no API calls in the dev gallery.</p>
          </section>
        </AgentWorkspace>
      );
    case 'mocks':
      return <Mockups />;
    case 'profile':
      return (
        <ProfilePanel
          email="sample.importer@example.test"
          roleLabel="Importer / client"
          onSignOut={() => undefined}
          state={state}
        />
      );
  }
}

/** Dev-only route: every component and state, in all three themes, side by side. */
export function DesignGallery({ screen, state }: Props = {}) {
  const previewScreen = asScreen(screen);
  const previewState = asState(state);

  if (previewScreen) {
    return (
      <main className="shell" aria-label={`Design preview: ${previewScreen}`}>
        <ScreenPreview screen={previewScreen} state={previewState} />
      </main>
    );
  }

  return (
    <main className="design-gallery">
      <header>
        <h1>Component gallery</h1>
        <p className="hint">Development only. Every state uses semantic tokens; no API calls.</p>
      </header>

      <div className="design-gallery__themes">
        {THEMES.map((theme) => (
          <section key={theme} className="design-gallery__panel" data-theme={theme}>
            <h2>{theme === 'cocoa' ? 'Cocoa Sky' : theme}</h2>

            <div className="design-gallery__row">
              <Button variant="primary">Approve</Button>
              <Button variant="secondary">Send draft</Button>
              <Button variant="destructive">Delete</Button>
              <Button variant="ghost">Skip</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>

            <div className="design-gallery__row">
              {TONES.map((tone) => (
                <StatusPill key={tone} tone={tone}>
                  {tone}
                </StatusPill>
              ))}
            </div>

            <StageTrack stage="submitted" />
            <StageTrack stage="on_hold" />

            <ThemeSwitcher />

            <div className="card">
              <h3>States</h3>
              {STATES.map((variant) => (
                <StatePanel key={variant} variant={variant} />
              ))}
            </div>

            <ReviewScreen
              revision={3}
              field="Declared value"
              draftValue="K 12,400"
              sourceValue="K 12,000"
              message="The draft value may not match your records. Check before you approve."
              onQuery={() => undefined}
              onApprove={() => undefined}
              onClearPoints={() => undefined}
            />

            <AgentDirectoryMock />
          </section>
        ))}
      </div>
    </main>
  );
}
