/* eslint-disable */
// Phase: importer self-service, step 3 — published agent directory and
// consented appointment. See docs/adr-importer-self-service.md.
//
// Importers work in their own tenant until appointment. On appointment a single
// SECURITY DEFINER function validates the request and MOVES the case and the
// importer user into the agency tenant in one transaction. There is no copy,
// no mirrored status row and no general cross-tenant read path. Licence data is
// SIMULATED; this module never contacts ZRA.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE agent_profiles (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      agency_name text NOT NULL,
      location text NOT NULL,
      service_area text,
      languages text,
      notes text,
      licence_status text NOT NULL DEFAULT 'SIMULATED'
        CONSTRAINT agent_profiles_licence_check CHECK (licence_status IN ('SIMULATED','VERIFIED')),
      is_published boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX agent_profiles_published_idx ON agent_profiles (is_published, agency_name);

    ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY agent_profiles_isolation ON agent_profiles
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    CREATE TABLE appointments (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      case_id uuid NOT NULL UNIQUE REFERENCES shipments(id) ON DELETE CASCADE,
      importer_user_id uuid NOT NULL REFERENCES users(id),
      agent_user_id uuid NOT NULL REFERENCES users(id),
      from_tenant_id uuid NOT NULL REFERENCES tenants(id),
      consent_text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX appointments_tenant_idx ON appointments (tenant_id, created_at);

    ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY appointments_isolation ON appointments
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    -- The only cross-tenant read in the product: curated, published directory
    -- fields. No email, phone, TPIN, document or assessment data is exposed.
    CREATE FUNCTION published_agent_directory()
      RETURNS TABLE(
        id uuid, tenant_id uuid, user_id uuid, agency_name text,
        location text, service_area text, languages text, licence_status text
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT ap.id, ap.tenant_id, ap.user_id, ap.agency_name, ap.location,
               ap.service_area, ap.languages, ap.licence_status
        FROM agent_profiles ap
        JOIN tenants t ON t.id = ap.tenant_id
        WHERE ap.is_published = true AND t.is_active = true
        ORDER BY ap.agency_name, ap.id;
      $$;

    -- Consented transfer. Every argument is validated before any row changes;
    -- a failure rolls the whole transaction back. IDs are supplied by the app
    -- so primary keys stay UUIDv7. Caller identity comes from app.user_id,
    -- which the API sets in the same transaction via withTenantAsUser.
    CREATE FUNCTION appoint_agent(
      p_appointment_id uuid,
      p_audit_from_id uuid,
      p_audit_to_id uuid,
      p_case_id uuid,
      p_agent_user_id uuid,
      p_consent_text text
    )
      RETURNS uuid
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      v_importer_id uuid := nullif(current_setting('app.user_id', true), '')::uuid;
      v_from_tenant uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
      v_case shipments%ROWTYPE;
      v_agent users%ROWTYPE;
      v_to_tenant uuid;
    BEGIN
      IF v_importer_id IS NULL OR v_from_tenant IS NULL THEN
        RAISE EXCEPTION 'appointment requires an authenticated importer session';
      END IF;
      IF p_consent_text IS NULL OR length(btrim(p_consent_text)) < 10
         OR length(p_consent_text) > 500 THEN
        RAISE EXCEPTION 'valid consent text is required';
      END IF;

      SELECT * INTO v_case FROM shipments
       WHERE id = p_case_id AND tenant_id = v_from_tenant AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'case not found';
      END IF;
      IF v_case.importer_user_id IS DISTINCT FROM v_importer_id THEN
        RAISE EXCEPTION 'only the importer on the case may appoint an agent';
      END IF;
      IF v_case.assigned_agent_id IS NOT NULL THEN
        RAISE EXCEPTION 'case already has an assigned agent';
      END IF;

      SELECT * INTO v_agent FROM users WHERE id = p_agent_user_id;
      IF NOT FOUND OR v_agent.is_active = false
         OR v_agent.role NOT IN ('agency_owner', 'agent_staff') THEN
        RAISE EXCEPTION 'agent is not available for appointment';
      END IF;

      SELECT t.id INTO v_to_tenant
        FROM tenants t WHERE t.id = v_agent.tenant_id AND t.is_active = true;
      IF v_to_tenant IS NULL THEN
        RAISE EXCEPTION 'agency tenant is not active';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM agent_profiles ap
         WHERE ap.user_id = p_agent_user_id
           AND ap.tenant_id = v_to_tenant
           AND ap.is_published = true
      ) THEN
        RAISE EXCEPTION 'agent has no published profile';
      END IF;

      INSERT INTO appointments (
        id, tenant_id, case_id, importer_user_id, agent_user_id,
        from_tenant_id, consent_text
      ) VALUES (
        p_appointment_id, v_to_tenant, p_case_id, v_importer_id, p_agent_user_id,
        v_from_tenant, p_consent_text
      );

      UPDATE shipments
         SET tenant_id = v_to_tenant,
             assigned_agent_id = p_agent_user_id,
             updated_at = now(),
             updated_by = v_importer_id
       WHERE id = p_case_id;

      UPDATE users
         SET tenant_id = v_to_tenant, updated_at = now()
       WHERE id = v_importer_id;

      -- The token still carries the old tenant id; force a fresh sign-in.
      UPDATE refresh_tokens
         SET revoked_at = now()
       WHERE user_id = v_importer_id AND revoked_at IS NULL;

      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action, entity_type, entity_id, metadata
      ) VALUES (
        p_audit_from_id, v_from_tenant, v_importer_id, 'case.appointed',
        'shipment', p_case_id,
        jsonb_build_object('agentUserId', p_agent_user_id, 'toTenantId', v_to_tenant)
      );
      INSERT INTO audit_logs (
        id, tenant_id, actor_user_id, action, entity_type, entity_id, metadata
      ) VALUES (
        p_audit_to_id, v_to_tenant, v_importer_id, 'case.received',
        'shipment', p_case_id,
        jsonb_build_object('consent', p_consent_text, 'fromTenantId', v_from_tenant)
      );

      RETURN v_to_tenant;
    END;
    $$;

    COMMENT ON FUNCTION appoint_agent(uuid, uuid, uuid, uuid, uuid, text) IS
      'Consented, audited transfer of an importer case into an agency tenant. No ZRA interaction.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS appoint_agent(uuid, uuid, uuid, uuid, uuid, text);
    DROP FUNCTION IF EXISTS published_agent_directory();
    DROP TABLE IF EXISTS appointments;
    DROP TABLE IF EXISTS agent_profiles;
  `);
};
