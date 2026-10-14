/* eslint-disable */
// Phase 2: shipments, the append-only stage timeline, and empty tariff tables.
//
// The shipment record is the agent's *manual* account of where cargo has
// reached. Customs declarations, duty assessment and release physically happen
// in ASYCUDA World; nothing here talks to ZRA.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE shipments (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      reference text NOT NULL,
      client_name text NOT NULL,
      client_contact text,
      type text NOT NULL,
      stage text NOT NULL DEFAULT 'docs_received',
      hold_reason text,
      origin text,
      destination text,
      consignment jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      updated_by uuid,
      CONSTRAINT shipments_type_check CHECK (type IN ('import','export','transit')),
      CONSTRAINT shipments_stage_check CHECK (
        stage IN ('docs_received','submitted','duty_assessed','duty_paid','released','in_transit','delivered','on_hold')
      ),
      -- A hold is only meaningful with a reason; every other stage must not
      -- carry a stale hold reason.
      CONSTRAINT shipments_hold_reason_check CHECK (
        (stage = 'on_hold' AND hold_reason IS NOT NULL) OR (stage <> 'on_hold' AND hold_reason IS NULL)
      )
    );

    -- The agency's own reference is unique within their tenant only.
    CREATE UNIQUE INDEX shipments_tenant_reference_unique ON shipments (tenant_id, lower(reference));
    CREATE INDEX shipments_tenant_stage_idx ON shipments (tenant_id, stage);
    CREATE INDEX shipments_tenant_created_idx ON shipments (tenant_id, created_at DESC);

    -- Append-only timeline. Every stage change writes one row; rows are never
    -- edited or deleted, which is what makes the history trustworthy.
    CREATE TABLE shipment_events (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
      from_stage text,
      to_stage text NOT NULL,
      note text,
      source text NOT NULL DEFAULT 'manual',
      actor_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT shipment_events_source_check CHECK (source IN ('manual','system'))
    );
    CREATE INDEX shipment_events_shipment_created_idx ON shipment_events (shipment_id, created_at);
    CREATE INDEX shipment_events_tenant_idx ON shipment_events (tenant_id);

    CREATE FUNCTION reject_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
      END;
    $$;

    CREATE TRIGGER shipment_events_append_only
      BEFORE UPDATE OR DELETE ON shipment_events
      FOR EACH ROW EXECUTE FUNCTION reject_mutation();

    ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY shipments_isolation ON shipments
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY shipment_events_isolation ON shipment_events
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    -- Tariff and duty reference data. These are national (ZRA) figures, not
    -- tenant data, so no RLS. They start EMPTY and every schedule is flagged
    -- NEEDS_VERIFICATION: we never invent duty, VAT or fee numbers. Rates are
    -- integer basis points (e.g. 1600 = 16.00%) and stay NULL until confirmed
    -- against current ZRA sources.
    CREATE TABLE tariff_schedules (
      id uuid PRIMARY KEY,
      code text NOT NULL,
      name text NOT NULL,
      currency text NOT NULL DEFAULT 'ZMW',
      effective_from date,
      effective_to date,
      verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION',
      source_note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT tariff_schedules_status_check CHECK (
        verification_status IN ('NEEDS_VERIFICATION','VERIFIED','SUPERSEDED')
      ),
      CONSTRAINT tariff_schedules_window_check CHECK (
        effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from
      )
    );
    CREATE UNIQUE INDEX tariff_schedules_code_unique ON tariff_schedules (code);

    CREATE TABLE tariff_lines (
      id uuid PRIMARY KEY,
      schedule_id uuid NOT NULL REFERENCES tariff_schedules(id) ON DELETE CASCADE,
      hs_code text NOT NULL,
      description text NOT NULL,
      duty_rate_bp integer,
      vat_rate_bp integer,
      unit text,
      notes text,
      verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION',
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT tariff_lines_status_check CHECK (
        verification_status IN ('NEEDS_VERIFICATION','VERIFIED','SUPERSEDED')
      ),
      CONSTRAINT tariff_lines_duty_rate_check CHECK (
        duty_rate_bp IS NULL OR (duty_rate_bp >= 0 AND duty_rate_bp <= 100000)
      ),
      CONSTRAINT tariff_lines_vat_rate_check CHECK (
        vat_rate_bp IS NULL OR (vat_rate_bp >= 0 AND vat_rate_bp <= 100000)
      )
    );
    CREATE INDEX tariff_lines_schedule_idx ON tariff_lines (schedule_id);
    CREATE INDEX tariff_lines_hs_code_idx ON tariff_lines (hs_code);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS tariff_lines;
    DROP TABLE IF EXISTS tariff_schedules;
    DROP TRIGGER IF EXISTS shipment_events_append_only ON shipment_events;
    DROP FUNCTION IF EXISTS reject_mutation();
    DROP TABLE IF EXISTS shipment_events;
    DROP TABLE IF EXISTS shipments;
  `);
};
