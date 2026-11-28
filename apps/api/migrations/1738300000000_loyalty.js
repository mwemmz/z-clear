/* eslint-disable */
// Phase: loyalty structure — versioned point and referral programme config.
//
// No earning rates, redemption values, expiry windows or reward claims are
// seeded. Both programmes start with no config rows and are treated as
// NEEDS_VERIFICATION. The ledger and referral tables are append-only,
// tenant-scoped records for the future owner-configured programme. Nothing
// here files anything with ZRA or represents a customs assessment or release.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE loyalty_program_config (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      program_type text NOT NULL CHECK (program_type IN ('points','referrals')),
      version integer NOT NULL CHECK (version > 0),
      verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION'
        CHECK (verification_status IN ('NEEDS_VERIFICATION','VERIFIED','SUPERSEDED')),
      rules jsonb NOT NULL DEFAULT '{}'::jsonb,
      source_note text,
      configured_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      CONSTRAINT loyalty_program_config_version_unique
        UNIQUE (tenant_id, program_type, version),
      CONSTRAINT loyalty_program_config_verified_complete CHECK (
        verification_status <> 'VERIFIED' OR (
          configured_at IS NOT NULL
          AND source_note IS NOT NULL
          AND btrim(source_note) <> ''
          AND jsonb_typeof(rules) = 'object'
          AND rules <> '{}'::jsonb
        )
      )
    );

    CREATE INDEX loyalty_program_config_tenant_type_version_idx
      ON loyalty_program_config (tenant_id, program_type, version DESC);

    COMMENT ON TABLE loyalty_program_config IS
      'Versioned owner-supplied programme rules. No values are seeded; VERIFIED requires a source note and non-empty rules.';
    COMMENT ON COLUMN loyalty_program_config.rules IS
      'Opaque owner-supplied rules. Never generated from customs duties, taxes or fees.';

    ALTER TABLE loyalty_program_config ENABLE ROW LEVEL SECURITY;
    CREATE POLICY loyalty_program_config_isolation ON loyalty_program_config
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    CREATE TABLE point_ledger_entries (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      source_type text NOT NULL CHECK (source_type IN ('configured_event','manual_adjustment')),
      reason_code text NOT NULL CHECK (btrim(reason_code) <> ''),
      source_id text,
      points integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX point_ledger_entries_tenant_user_created_idx
      ON point_ledger_entries (tenant_id, user_id, created_at DESC);

    COMMENT ON TABLE point_ledger_entries IS
      'Append-only point ledger. Rows are structural until versioned, verified programme rules exist.';

    ALTER TABLE point_ledger_entries ENABLE ROW LEVEL SECURITY;
    CREATE POLICY point_ledger_entries_isolation ON point_ledger_entries
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    CREATE TRIGGER point_ledger_entries_append_only
      BEFORE UPDATE OR DELETE ON point_ledger_entries
      FOR EACH ROW EXECUTE FUNCTION reject_mutation();

    CREATE TABLE referral_records (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      state text NOT NULL DEFAULT 'recorded' CHECK (state = 'recorded'),
      source_note text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX referral_records_tenant_referrer_created_idx
      ON referral_records (tenant_id, referrer_user_id, created_at DESC);

    COMMENT ON TABLE referral_records IS
      'Append-only referral records. Structural only; no reward or incentive claim is encoded.';

    ALTER TABLE referral_records ENABLE ROW LEVEL SECURITY;
    CREATE POLICY referral_records_isolation ON referral_records
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    CREATE TRIGGER referral_records_append_only
      BEFORE UPDATE OR DELETE ON referral_records
      FOR EACH ROW EXECUTE FUNCTION reject_mutation();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS referral_records_isolation ON referral_records;
    DROP POLICY IF EXISTS point_ledger_entries_isolation ON point_ledger_entries;
    DROP POLICY IF EXISTS loyalty_program_config_isolation ON loyalty_program_config;
    DROP TABLE IF EXISTS referral_records;
    DROP TABLE IF EXISTS point_ledger_entries;
    DROP TABLE IF EXISTS loyalty_program_config;
  `);
};
