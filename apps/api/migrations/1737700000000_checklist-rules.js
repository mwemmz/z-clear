/* eslint-disable */
// Phase: importer self-service, step 2 — personalised checklist.
//
// Extends the agency-owned document_requirements config so a rule can target a
// case kind (vehicle/goods) and carry evidence provenance. No legal document
// list is seeded: rows are tenant config, and any row without a VERIFIED
// source must be shown to the importer as unverified. Nothing here is a ZRA
// requirement or an assessment.

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE document_requirements
      ADD COLUMN case_kind text,
      ADD COLUMN source_url text,
      ADD COLUMN effective_date date,
      ADD COLUMN verification_status text NOT NULL DEFAULT 'NEEDS_VERIFICATION';

    ALTER TABLE document_requirements
      ADD CONSTRAINT document_requirements_case_kind_check
        CHECK (case_kind IS NULL OR case_kind IN ('vehicle','goods')),
      ADD CONSTRAINT document_requirements_verification_check
        CHECK (verification_status IN ('NEEDS_VERIFICATION','VERIFIED','SUPERSEDED'));

    -- A rule may apply to all cases (NULL case_kind) or to one kind only, so
    -- case_kind is part of the uniqueness key. COALESCE keeps the old
    -- all-cases rows distinct from an explicit kind.
    DROP INDEX document_requirements_tenant_type_doc_unique;
    CREATE UNIQUE INDEX document_requirements_tenant_type_kind_doc_unique
      ON document_requirements (tenant_id, shipment_type, COALESCE(case_kind, ''), lower(doc_type));

    CREATE INDEX document_requirements_checklist_idx
      ON document_requirements (tenant_id, shipment_type, case_kind, is_active, sort_order);

    COMMENT ON COLUMN document_requirements.source_url IS
      'Link to the source of this rule. NULL means unverified guidance only.';
    COMMENT ON COLUMN document_requirements.effective_date IS
      'Date from which this rule is said to apply. Not a ZRA effective date unless VERIFIED.';
    COMMENT ON COLUMN document_requirements.verification_status IS
      'NEEDS_VERIFICATION by default; VERIFIED only against a current ZRA source.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS document_requirements_checklist_idx;
    DROP INDEX IF EXISTS document_requirements_tenant_type_kind_doc_unique;
    CREATE UNIQUE INDEX document_requirements_tenant_type_doc_unique
      ON document_requirements (tenant_id, shipment_type, lower(doc_type));

    ALTER TABLE document_requirements
      DROP CONSTRAINT IF EXISTS document_requirements_verification_check,
      DROP CONSTRAINT IF EXISTS document_requirements_case_kind_check,
      DROP COLUMN IF EXISTS verification_status,
      DROP COLUMN IF EXISTS effective_date,
      DROP COLUMN IF EXISTS source_url,
      DROP COLUMN IF EXISTS case_kind;
  `);
};
