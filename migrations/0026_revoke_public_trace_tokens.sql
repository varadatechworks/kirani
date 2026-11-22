BEGIN;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS public_token_revoked_at timestamptz;
CREATE INDEX IF NOT EXISTS packages_active_public_trace_idx ON packages(public_token) WHERE public_token_revoked_at IS NULL;
COMMIT;
