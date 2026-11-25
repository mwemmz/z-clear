import { MockScreen } from './MockScreen';

/** Zamtel SIM sign-up and PIN screen (sample data). */
export function MockSignupPin() {
  return (
    <MockScreen
      label="Zamtel SIM sign-up & PIN"
      note="Importer signs up with a Zamtel SIM and sets a 4-digit PIN."
    >
      <form className="mock-form" onSubmit={(event) => event.preventDefault()}>
        <label className="mock-form__row">
          <span>Mobile number</span>
          <input type="tel" value="+260 95 000 0000" readOnly />
        </label>
        <label className="mock-form__row">
          <span>Full name</span>
          <input type="text" value="Kafue Metals Ltd — imports desk" readOnly />
        </label>
        <label className="mock-form__row">
          <span>Choose a 4-digit PIN</span>
          <input type="password" value="••••" readOnly />
        </label>
        <label className="mock-form__row">
          <span>Confirm PIN</span>
          <input type="password" value="••••" readOnly />
        </label>
        <button type="button" className="mock-btn">
          Sign up
        </button>
      </form>
      <p className="mock-hint">
        PIN never leaves the phone unhashed; SIM ownership is the identity anchor for the demo.
      </p>
    </MockScreen>
  );
}
