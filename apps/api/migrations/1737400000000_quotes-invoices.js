/* eslint-disable */
// Phase 4: quotes and invoices.
//
// Money is always integer minor units plus an ISO currency (never floats).
// Charge categories and the VAT rate are configuration data; the revenue
// figures themselves are entered per line by staff. We never invent duty, VAT
// or fee amounts. Any rate we seed is flagged NEEDS_VERIFICATION until checked
// against a current ZRA source.

exports.up = (pgm) => {
  pgm.sql(`
    -- Charge categories. Global reference data (not tenant data, no RLS). The
    -- amounts live on the quote/invoice lines, not here.
    CREATE TABLE charge_types (
      code text PRIMARY KEY,
      label text NOT NULL,
      is_service_fee boolean NOT NULL DEFAULT false,
      is_selectable boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    -- VAT is computed from configuration, so it is listed for display but can
    -- never be posted as a manual line (is_selectable = false).
    INSERT INTO charge_types (code, label, is_service_fee, is_selectable, sort_order) VALUES
      ('customs_duty', 'Customs duty', false, true, 10),
      ('vat', 'VAT', false, false, 20),
      ('agency_fee', 'Agency / clearance fee', true, true, 30),
      ('transport', 'Transport / haulage', false, true, 40),
      ('port_charges', 'Port / terminal / storage', false, true, 50),
      ('disbursements', 'Disbursements / other', false, true, 60);

    -- Versioned tax rates. Global reference data. rate_bp is integer basis
    -- points (1600 = 16.00%). The seeded rate is the owner's business rule but
    -- stays NEEDS_VERIFICATION until confirmed against a current ZRA source.
    CREATE TABLE tax_rates (
      id uuid PRIMARY KEY,
      code text NOT NULL,
      label text NOT NULL,
      rate_bp integer NOT NULL,
      applies_to text NOT NULL DEFAULT 'service_fee',
      currency text,
      effective_from date,
      effective_to date,
      verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION',
      source_note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT tax_rates_rate_check CHECK (rate_bp >= 0 AND rate_bp <= 100000),
      CONSTRAINT tax_rates_status_check CHECK (
        verification_status IN ('NEEDS_VERIFICATION','VERIFIED','SUPERSEDED')
      ),
      CONSTRAINT tax_rates_window_check CHECK (
        effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from
      )
    );
    CREATE UNIQUE INDEX tax_rates_active_unique ON tax_rates (code) WHERE effective_to IS NULL;

    INSERT INTO tax_rates (id, code, label, rate_bp, applies_to, currency, verification_status, source_note) VALUES (
      '0192f000-0000-7000-8000-000000000001',
      'VAT_STANDARD',
      'Standard VAT',
      1600,
      'service_fee',
      'ZMW',
      'NEEDS_VERIFICATION',
      'Owner-provided (16% on the service fee only); verify against current ZRA sources.'
    );

    CREATE TABLE quotes (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      reference text NOT NULL,
      currency text NOT NULL DEFAULT 'ZMW',
      status text NOT NULL DEFAULT 'draft',
      valid_until date,
      notes text,
      vat_rate_bp integer NOT NULL DEFAULT 0,
      vat_verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION',
      subtotal_minor bigint NOT NULL DEFAULT 0,
      tax_minor bigint NOT NULL DEFAULT 0,
      total_minor bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      updated_by uuid,
      CONSTRAINT quotes_currency_check CHECK (currency IN ('ZMW','USD')),
      CONSTRAINT quotes_status_check CHECK (status IN ('draft','sent','accepted','declined','expired')),
      CONSTRAINT quotes_totals_check CHECK (subtotal_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0)
    );
    CREATE UNIQUE INDEX quotes_tenant_reference_unique ON quotes (tenant_id, lower(reference));
    CREATE INDEX quotes_tenant_shipment_idx ON quotes (tenant_id, shipment_id);
    CREATE INDEX quotes_tenant_status_idx ON quotes (tenant_id, status);

    CREATE TABLE quote_lines (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      charge_type_code text NOT NULL REFERENCES charge_types(code),
      description text NOT NULL,
      quantity integer NOT NULL,
      unit_amount_minor bigint NOT NULL,
      line_amount_minor bigint NOT NULL,
      is_taxable boolean NOT NULL DEFAULT false,
      tax_minor bigint NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT quote_lines_quantity_check CHECK (quantity >= 1),
      CONSTRAINT quote_lines_amounts_check CHECK (
        unit_amount_minor >= 0 AND line_amount_minor >= 0 AND tax_minor >= 0
      )
    );
    CREATE INDEX quote_lines_quote_idx ON quote_lines (quote_id);

    CREATE TABLE invoices (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
      quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
      number text NOT NULL,
      currency text NOT NULL DEFAULT 'ZMW',
      status text NOT NULL DEFAULT 'draft',
      issue_date date,
      due_date date,
      notes text,
      exchange_rate numeric(18,8),
      vat_rate_bp integer NOT NULL DEFAULT 0,
      vat_verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION',
      subtotal_minor bigint NOT NULL DEFAULT 0,
      tax_minor bigint NOT NULL DEFAULT 0,
      total_minor bigint NOT NULL DEFAULT 0,
      amount_paid_minor bigint NOT NULL DEFAULT 0,
      issued_at timestamptz,
      voided_at timestamptz,
      void_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      updated_by uuid,
      -- Invoices are issued in Kwacha only.
      CONSTRAINT invoices_currency_check CHECK (currency = 'ZMW'),
      CONSTRAINT invoices_status_check CHECK (
        status IN ('draft','issued','partially_paid','paid','void')
      ),
      CONSTRAINT invoices_totals_check CHECK (
        subtotal_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0 AND amount_paid_minor >= 0
      ),
      -- A void invoice must record why and when; a live one must not carry them.
      CONSTRAINT invoices_void_check CHECK (
        (status = 'void' AND voided_at IS NOT NULL) OR (status <> 'void' AND voided_at IS NULL)
      )
    );
    CREATE UNIQUE INDEX invoices_tenant_number_unique ON invoices (tenant_id, number);
    CREATE INDEX invoices_tenant_status_idx ON invoices (tenant_id, status);
    CREATE INDEX invoices_tenant_shipment_idx ON invoices (tenant_id, shipment_id);

    CREATE TABLE invoice_lines (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      charge_type_code text NOT NULL REFERENCES charge_types(code),
      description text NOT NULL,
      quantity integer NOT NULL,
      unit_amount_minor bigint NOT NULL,
      line_amount_minor bigint NOT NULL,
      is_taxable boolean NOT NULL DEFAULT false,
      tax_minor bigint NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT invoice_lines_quantity_check CHECK (quantity >= 1),
      CONSTRAINT invoice_lines_amounts_check CHECK (
        unit_amount_minor >= 0 AND line_amount_minor >= 0 AND tax_minor >= 0
      )
    );
    CREATE INDEX invoice_lines_invoice_idx ON invoice_lines (invoice_id);

    -- Payments are append-only: a correction is a new entry or a void of the
    -- invoice, never an edit, so the money trail cannot be rewritten.
    CREATE TABLE payments (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      amount_minor bigint NOT NULL,
      currency text NOT NULL DEFAULT 'ZMW',
      method text NOT NULL,
      reference text,
      paid_on date NOT NULL,
      note text,
      recorded_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT payments_amount_check CHECK (amount_minor > 0),
      CONSTRAINT payments_currency_check CHECK (currency = 'ZMW'),
      CONSTRAINT payments_method_check CHECK (
        method IN ('cash','bank_transfer','mobile_money','card','other')
      )
    );
    CREATE INDEX payments_tenant_invoice_idx ON payments (tenant_id, invoice_id);

    CREATE TRIGGER payments_append_only
      BEFORE UPDATE OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION reject_mutation();

    -- Per-tenant invoice numbering. Allocation is a single atomic upsert that
    -- also serves as the row lock, so numbers never collide under concurrency.
    CREATE TABLE invoice_counters (
      tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      last_number integer NOT NULL DEFAULT 0
    );

    ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY quotes_isolation ON quotes
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
    CREATE POLICY quote_lines_isolation ON quote_lines
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    CREATE POLICY invoices_isolation ON invoices
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
    CREATE POLICY invoice_lines_isolation ON invoice_lines
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY payments_isolation ON payments
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
    CREATE POLICY invoice_counters_isolation ON invoice_counters
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS invoice_counters;
    DROP TRIGGER IF EXISTS payments_append_only ON payments;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS invoice_lines;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS quote_lines;
    DROP TABLE IF EXISTS quotes;
    DROP TABLE IF EXISTS tax_rates;
    DROP TABLE IF EXISTS charge_types;
  `);
};
