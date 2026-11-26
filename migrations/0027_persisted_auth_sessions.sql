BEGIN;
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK(expires_at>created_at),
  CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX user_sessions_active_user_idx ON user_sessions(tenant_id,user_id,expires_at) WHERE revoked_at IS NULL;
COMMIT;
