/* eslint-disable */
// Tracks the one-time hosted demo seed. The marker is tenant-owned and covered
// by RLS like every other app table. It records only a seed version and time;
// no credentials, customer data or customs data are stored here.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE demo_seed_state (
      tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      seed_version text NOT NULL,
      seeded_at timestamptz NOT NULL DEFAULT now()
    );

    COMMENT ON TABLE demo_seed_state IS
      'One-time marker for the synthetic hosted demo seed. Not customer or customs data.';

    ALTER TABLE demo_seed_state ENABLE ROW LEVEL SECURITY;
    CREATE POLICY demo_seed_state_isolation ON demo_seed_state
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS demo_seed_state_isolation ON demo_seed_state;
    DROP TABLE IF EXISTS demo_seed_state;
  `);
};
