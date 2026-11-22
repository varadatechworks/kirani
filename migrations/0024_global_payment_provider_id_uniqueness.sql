BEGIN;
-- Provider-generated identifiers are globally unique at the gateway, not merely within one Kirani tenant.
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_provider_order_global_uq
 ON payment_intents(provider,provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_payment_global_uq
 ON payment_transactions(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
COMMIT;
