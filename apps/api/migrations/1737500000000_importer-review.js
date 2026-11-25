/* eslint-disable */
// Phase 5: importer review workflow.
//
// Adds importer/agent assignment columns to shipments, a revision-based
// importer_reviews table (draft -> in_review -> queried -> approved), and an
// append-only review_points ledger written in the same transaction as the
// state change it rewards.
//
// Review here is an internal completeness checklist the agent runs *before*
// the manual ASYCUDA World filing — it never computes duty, VAT or fees.

exports.up = (pgm) => {
  pgm.sql(`
    -- Importer tax number carried on the user record. Synthetic values in
    -- demo/seed data; production would field-encrypt this (SECURITY.md).
    ALTER TABLE users ADD COLUMN tpin text;

    ALTER TABLE shipments ADD COLUMN importer_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE shipments ADD COLUMN assigned_agent_id uuid REFERENCES users(id) ON DELETE SET NULL;
    -- Material-edit freshness counter: bumped by the application whenever a
    -- material field changes. A review revision stores the value it was
    -- created against, so approval can detect stale revisions.
    ALTER TABLE shipments ADD COLUMN review_freshness integer NOT NULL DEFAULT 0;

    CREATE INDEX shipments_tenant_importer_idx ON shipments (tenant_id, importer_user_id);
    CREATE INDEX shipments_tenant_agent_idx ON shipments (tenant_id, assigned_agent_id);

    CREATE TABLE importer_reviews (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
      revision integer NOT NULL,
      parent_review_id uuid REFERENCES importer_reviews(id) ON DELETE SET NULL,
      state text NOT NULL DEFAULT 'draft',
      -- Message shown to the importer for this revision.
      message text,
      -- Importer's question when they queried the revision.
      query text,
      sent_at timestamptz,
      queried_at timestamptz,
      approved_at timestamptz,
      sent_by uuid,
      approved_by uuid,
      -- Snapshot of the shipment data this revision was raised against, so a
      -- later shipment edit cannot silently change what was approved.
      shipment_reference text NOT NULL,
      client_name text NOT NULL,
      client_contact text,
      shipment_type text NOT NULL,
      origin text,
      destination text,
      consignment jsonb NOT NULL DEFAULT '{}'::jsonb,
      -- Freshness accounting: shipments.review_freshness when this revision
      -- was created. Approval requires the counter to still match.
      baseline_freshness integer NOT NULL,
      -- Deterministic draft check output for this revision.
      draft_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
      draft_check_version integer NOT NULL DEFAULT 1,
      draft_blocked boolean NOT NULL DEFAULT false,
      -- Optional AI wording step (FEATURE_AI). wording_source records which
      -- wording actually shipped: 'ai' or the fixed 'fallback'.
      wording text,
      wording_source text NOT NULL DEFAULT 'fixed',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      CONSTRAINT importer_reviews_state_check CHECK (
        state IN ('draft','in_review','queried','approved')
      ),
      CONSTRAINT importer_reviews_revision_check CHECK (revision >= 1),
      CONSTRAINT importer_reviews_timing_check CHECK (
        (sent_at IS NULL OR created_at IS NOT NULL)
      )
    );
    CREATE UNIQUE INDEX importer_reviews_shipment_revision_unique
      ON importer_reviews (tenant_id, shipment_id, revision);
    CREATE INDEX importer_reviews_tenant_state_idx ON importer_reviews (tenant_id, state);
    CREATE INDEX importer_reviews_tenant_shipment_idx ON importer_reviews (tenant_id, shipment_id);

    -- Internal engagement points ledger. Append-only like payments: a
    -- correction is a policy change, never an edit. One row per
    -- (tenant, review, event) is enforced by the unique index below, so a
    -- qualifying event can earn points exactly once.
    CREATE TABLE review_points (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
      review_id uuid NOT NULL REFERENCES importer_reviews(id) ON DELETE RESTRICT,
      event text NOT NULL,
      points integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT review_points_event_check CHECK (event IN ('review_sent','review_approved')),
      CONSTRAINT review_points_points_check CHECK (points > 0)
    );
    CREATE UNIQUE INDEX review_points_event_unique ON review_points (tenant_id, review_id, event);
    CREATE INDEX review_points_tenant_user_idx ON review_points (tenant_id, user_id);

    CREATE TRIGGER review_points_append_only
      BEFORE UPDATE OR DELETE ON review_points
      FOR EACH ROW EXECUTE FUNCTION reject_mutation();

    ALTER TABLE importer_reviews ENABLE ROW LEVEL SECURITY;
    CREATE POLICY importer_reviews_isolation ON importer_reviews
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE review_points ENABLE ROW LEVEL SECURITY;
    CREATE POLICY review_points_isolation ON review_points
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS review_points_append_only ON review_points;
    DROP TABLE IF EXISTS review_points;
    DROP TABLE IF EXISTS importer_reviews;
    DROP INDEX IF EXISTS shipments_tenant_agent_idx;
    DROP INDEX IF EXISTS shipments_tenant_importer_idx;
    ALTER TABLE shipments DROP COLUMN IF EXISTS review_freshness;
    ALTER TABLE shipments DROP COLUMN IF EXISTS assigned_agent_id;
    ALTER TABLE shipments DROP COLUMN IF EXISTS importer_user_id;
    ALTER TABLE users DROP COLUMN IF EXISTS tpin;
  `);
};
