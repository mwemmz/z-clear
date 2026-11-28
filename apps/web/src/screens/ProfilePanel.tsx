import { StatePanel, ThemeSwitcher, type StateVariant } from '../ui';

interface Props {
  email: string;
  roleLabel: string;
  onSignOut: () => void;
  state?: StateVariant;
}

/** Profile/settings: the second entry point for the three-theme control. */
export function ProfilePanel({ email, roleLabel, onSignOut, state }: Props) {
  if (state) {
    return (
      <section
        className="card profile-panel"
        data-testid="profile-panel"
        aria-labelledby="profile-heading"
      >
        <h2 className="sr-only" id="profile-heading">
          Profile
        </h2>
        <StatePanel variant={state} />
      </section>
    );
  }

  return (
    <section
      className="card profile-panel"
      data-testid="profile-panel"
      aria-labelledby="profile-heading"
    >
      <div className="profile-panel__section">
        <span className="eyebrow">Account</span>
        <h2 id="profile-heading">Profile</h2>
        <p className="recent-cases__meta">{email}</p>
        <p>{roleLabel}</p>
      </div>
      <div className="profile-panel__section">
        <strong>Colour theme</strong>
        <p className="recent-cases__meta">
          Saved on this phone. English first; Bemba and Nyanja strings next.
        </p>
        <ThemeSwitcher />
      </div>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
