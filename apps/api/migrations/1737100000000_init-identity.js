/* eslint-disable */
// Phase 1: tenancy, identity, sessions, audit.
//
// Written as raw SQL through pgm.sql for reviewability. RLS is enabled on every
// tenant-owned table and fail-closed: when `app.tenant_id` is unset the policy
// predicate evaluates to NULL and no rows are visible or writable.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE tenants (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid
    );

    CREATE TABLE users (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      email text NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      totp_secret text,
      totp_enabled boolean NOT NULL DEFAULT false,
      failed_login_attempts integer NOT NULL DEFAULT 0,
      locked_until timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid,
      CONSTRAINT users_role_check CHECK (role IN ('agency_owner','agent_staff','client_viewer','platform_admin'))
    );

    -- Email is globally unique in Phase 1 (one account per person, one agency).
    CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
    CREATE INDEX users_tenant_idx ON users (tenant_id);

    CREATE TABLE refresh_tokens (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      replaced_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX refresh_tokens_hash_unique ON refresh_tokens (token_hash);
    CREATE INDEX refresh_tokens_tenant_idx ON refresh_tokens (tenant_id);
    CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

    CREATE TABLE audit_logs (
      id uuid PRIMARY KEY,
      tenant_id uuid,
      actor_user_id uuid,
      action text NOT NULL,
      entity_type text,
      entity_id uuid,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      ip text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC);

    -- Append-only: reject any UPDATE or DELETE regardless of role.
    CREATE FUNCTION audit_logs_block_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
    $$;
    CREATE TRIGGER audit_logs_append_only
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

    -- Row-Level Security (fail-closed). nullif guards the empty-string reset
    -- value PostgreSQL keeps for a custom GUC after a transaction ends, so an
    -- unset tenant yields NULL (no rows) instead of a cast error.
    ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenants_isolation ON tenants
      USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY users_isolation ON users
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
    CREATE POLICY refresh_tokens_isolation ON refresh_tokens
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY audit_logs_isolation ON audit_logs
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

    -- Authentication must run before a tenant is known, so login/refresh look
    -- up rows through SECURITY DEFINER functions that bypass RLS by owner
    -- rights. They return only the columns the auth flow needs.
    CREATE FUNCTION auth_login_lookup(p_email text)
      RETURNS TABLE(
        id uuid, tenant_id uuid, password_hash text, role text,
        is_active boolean, failed_login_attempts integer, locked_until timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT u.id, u.tenant_id, u.password_hash, u.role::text,
               u.is_active, u.failed_login_attempts, u.locked_until
        FROM users u
        WHERE lower(u.email) = lower(p_email)
        LIMIT 1;
      $$;

    CREATE FUNCTION auth_refresh_lookup(p_hash text)
      RETURNS TABLE(
        id uuid, tenant_id uuid, user_id uuid, expires_at timestamptz, revoked_at timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT r.id, r.tenant_id, r.user_id, r.expires_at, r.revoked_at
        FROM refresh_tokens r
        WHERE r.token_hash = p_hash
        LIMIT 1;
      $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS auth_refresh_lookup(text);
    DROP FUNCTION IF EXISTS auth_login_lookup(text);
    DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
    DROP FUNCTION IF EXISTS audit_logs_block_mutation();
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS refresh_tokens;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS tenants;
  `);
};
