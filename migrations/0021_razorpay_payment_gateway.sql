BEGIN;
ALTER TABLE payment_transactions ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE payment_ledger ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_order_id text;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_payment_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_payment_uq
 ON payment_transactions(tenant_id,provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS payment_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 order_id uuid NOT NULL REFERENCES orders(id),
 provider text NOT NULL CHECK(provider IN ('RAZORPAY')),
 provider_order_id text,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 currency char(3) NOT NULL DEFAULT 'INR',
 status text NOT NULL DEFAULT 'CREATING' CHECK(status IN ('CREATING','OPEN','PAID','FAILED','CANCELLED')),
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,provider_order_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_one_open_order_uq
 ON payment_intents(tenant_id,order_id,provider) WHERE status IN ('CREATING','OPEN');
CREATE TABLE IF NOT EXISTS payment_gateway_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 provider text NOT NULL,
 event_id text NOT NULL,
 event_type text NOT NULL,
 payload jsonb NOT NULL,
 signature_verified boolean NOT NULL,
 processed_at timestamptz,
 processing_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,event_id)
);
CREATE INDEX IF NOT EXISTS payment_gateway_events_pending_idx
 ON payment_gateway_events(tenant_id,created_at) WHERE processed_at IS NULL;
COMMIT;
