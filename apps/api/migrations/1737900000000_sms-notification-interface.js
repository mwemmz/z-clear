/* eslint-disable */
// Step 6: SMS notification interface + mock implementation.
//
// No real SMS/WhatsApp provider is implemented. `sms_mock` records an outcome
// in the append-only outbox and sends nothing; `sms` and `whatsapp` keep failing
// closed in the provider factory. Phone numbers are tenant user data, never
// hardcoded in code or fixtures.

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN phone text
        CONSTRAINT users_phone_check
        CHECK (phone IS NULL OR phone ~ '^[0-9+][0-9 -]{6,19}$');

    ALTER TABLE notification_outbox
      ADD COLUMN recipient_phone text;

    ALTER TABLE notification_outbox
      DROP CONSTRAINT notification_outbox_channel_check;
    ALTER TABLE notification_outbox
      ADD CONSTRAINT notification_outbox_channel_check
      CHECK (channel IN ('email', 'mock', 'sms_mock'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE notification_outbox
      DROP CONSTRAINT notification_outbox_channel_check;
    ALTER TABLE notification_outbox
      ADD CONSTRAINT notification_outbox_channel_check
      CHECK (channel IN ('email', 'mock'));
    ALTER TABLE notification_outbox DROP COLUMN IF EXISTS recipient_phone;
    ALTER TABLE users DROP COLUMN IF EXISTS phone;
  `);
};
