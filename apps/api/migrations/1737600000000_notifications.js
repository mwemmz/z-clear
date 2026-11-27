/* eslint-disable */
// Phase 5: notification outbox.
//
// Delivery outcomes are appended, never rewritten. Recipients are resolved from
// tenant users at emit time — no addresses or phone numbers exist in code or
// fixtures. The pilot channel is email, behind a configurable webhook seam.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE notification_outbox (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      entity_type text,
      entity_id uuid,
      recipient_user_id uuid,
      recipient_email text NOT NULL,
      channel text NOT NULL CHECK (channel IN ('email', 'mock')),
      subject text NOT NULL,
      body text NOT NULL,
      status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
      detail text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX notification_outbox_tenant_event_idx
      ON notification_outbox (tenant_id, event_type, created_at DESC);
    CREATE INDEX notification_outbox_entity_idx
      ON notification_outbox (tenant_id, entity_type, entity_id);

    CREATE TRIGGER notification_outbox_append_only
      BEFORE UPDATE OR DELETE ON notification_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_mutation();

    ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
    CREATE POLICY notification_outbox_isolation ON notification_outbox
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS notification_outbox_isolation ON notification_outbox;
    DROP TABLE IF EXISTS notification_outbox;
  `);
};
