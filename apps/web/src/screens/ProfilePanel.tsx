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
      <div>
        <h2 id="profile-heading">Profile</h2>
        <p className="recent-cases__meta">{email}</p>
        <p>{roleLabel}</p>
      </div>
      <div>
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
