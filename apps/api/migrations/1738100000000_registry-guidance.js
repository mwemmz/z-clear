/* eslint-disable */
// Phase: importer self-service — tenant-owned registry guidance.
//
// This table replaces the static "Registry guidance" mock with agency-owned
// configuration. No guidance is seeded: an empty tenant shows an empty state,
// and every row carries provenance. Nothing here files anything with ZRA, and
// NEEDS_VERIFICATION rows must be shown as unverified guidance only.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE registry_guidance (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      step_key text NOT NULL CHECK (step_key ~ '^[a-z0-9_]+$'),
      title text NOT NULL,
      detail text,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      source_url text,
      effective_date date,
      verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION'
        CHECK (verification_status IN ('NEEDS_VERIFICATION','VERIFIED','SUPERSEDED')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT registry_guidance_tenant_step_unique UNIQUE (tenant_id, step_key)
    );

    CREATE INDEX registry_guidance_tenant_sort_idx
      ON registry_guidance (tenant_id, is_active, sort_order);

    COMMENT ON TABLE registry_guidance IS
      'Agency-owned setup guidance. Not a ZRA requirement or assessment by default.';
    COMMENT ON COLUMN registry_guidance.verification_status IS
      'NEEDS_VERIFICATION unless a current source URL and effective date are recorded.';

    ALTER TABLE registry_guidance ENABLE ROW LEVEL SECURITY;
    CREATE POLICY registry_guidance_isolation ON registry_guidance
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS registry_guidance_isolation ON registry_guidance;
    DROP TABLE IF EXISTS registry_guidance;
  `);
};
