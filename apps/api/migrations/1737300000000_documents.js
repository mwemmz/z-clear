/* eslint-disable */
// Phase 3: documents, uploaded files, and the per-agency document checklist.
//
// Documents are the agent's checklist for a shipment (what is still missing).
// Files are the actual bytes, held in private object storage; only metadata and
// the storage key live in Postgres.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE documents (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      doc_type text NOT NULL,
      label text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      updated_by uuid,
      CONSTRAINT documents_status_check CHECK (status IN ('pending','uploaded','verified','rejected'))
    );
    CREATE INDEX documents_tenant_shipment_idx ON documents (tenant_id, shipment_id);
    CREATE UNIQUE INDEX documents_shipment_type_unique ON documents (shipment_id, lower(doc_type));

    CREATE TABLE files (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      storage_key text NOT NULL,
      original_name text NOT NULL,
      content_type text NOT NULL,
      size_bytes bigint NOT NULL,
      checksum_sha256 text NOT NULL,
      scan_status text NOT NULL DEFAULT 'pending',
      uploaded_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT files_size_check CHECK (size_bytes >= 0),
      CONSTRAINT files_scan_status_check CHECK (scan_status IN ('pending','clean','infected','failed','skipped'))
    );
    CREATE UNIQUE INDEX files_storage_key_unique ON files (storage_key);
    CREATE INDEX files_tenant_document_idx ON files (tenant_id, document_id);

    -- Per-agency checklist: which documents a shipment type requires. Ships
    -- EMPTY (config over code); agencies fill it in. is_mandatory drives the
    -- "missing documents" computation.
    CREATE TABLE document_requirements (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      shipment_type text NOT NULL,
      doc_type text NOT NULL,
      label text NOT NULL,
      is_mandatory boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT document_requirements_type_check CHECK (shipment_type IN ('import','export','transit'))
    );
    CREATE UNIQUE INDEX document_requirements_tenant_type_doc_unique
      ON document_requirements (tenant_id, shipment_type, lower(doc_type));

    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY documents_isolation ON documents
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE files ENABLE ROW LEVEL SECURITY;
    CREATE POLICY files_isolation ON files
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY document_requirements_isolation ON document_requirements
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS document_requirements;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS documents;
  `);
};
