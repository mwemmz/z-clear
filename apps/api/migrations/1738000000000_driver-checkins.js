/* eslint-disable */
/**
 * Driver role and manual border check-ins.
 *
 * Check-ins are appended to the existing append-only shipment_events ledger;
 * no live border or ZRA feed is involved. A driver is a tenant user assigned
 * to a shipment and can only check in that shipment. The stage itself is not
 * changed by a check-in — the agent remains in control of stage updates.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP CONSTRAINT users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('agency_owner', 'agent_staff', 'client_viewer', 'platform_admin', 'driver'));

    ALTER TABLE shipments
      ADD COLUMN driver_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX shipments_tenant_driver_idx ON shipments (tenant_id, driver_user_id);

    ALTER TABLE shipment_events DROP CONSTRAINT shipment_events_source_check;
    ALTER TABLE shipment_events ADD CONSTRAINT shipment_events_source_check
      CHECK (source IN ('manual', 'system', 'driver'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE shipment_events DROP CONSTRAINT shipment_events_source_check;
    ALTER TABLE shipment_events ADD CONSTRAINT shipment_events_source_check
      CHECK (source IN ('manual', 'system'));

    DROP INDEX shipments_tenant_driver_idx;
    ALTER TABLE shipments DROP COLUMN driver_user_id;

    ALTER TABLE users DROP CONSTRAINT users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('agency_owner', 'agent_staff', 'client_viewer', 'platform_admin'));
  `);
};
