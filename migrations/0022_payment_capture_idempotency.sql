BEGIN;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS provider_payment_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_provider_payment_uq
 ON payment_intents(tenant_id,provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_gateway_events_tenant_created_idx
 ON payment_gateway_events(tenant_id,created_at DESC);
COMMIT;
