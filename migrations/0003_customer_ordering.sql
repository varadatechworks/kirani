BEGIN;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 40),
  recipient_name text NOT NULL CHECK(length(trim(recipient_name)) BETWEEN 1 AND 160),
  phone text NOT NULL CHECK(phone ~ '^[0-9+() -]{7,20}$'),
  line1 text NOT NULL CHECK(length(trim(line1)) BETWEEN 3 AND 200),
  line2 text,
  landmark text,
  locality text NOT NULL CHECK(length(trim(locality)) BETWEEN 2 AND 120),
  city text NOT NULL CHECK(length(trim(city)) BETWEEN 2 AND 100),
  state text NOT NULL CHECK(length(trim(state)) BETWEEN 2 AND 100),
  postal_code text NOT NULL CHECK(postal_code ~ '^[0-9]{6}$'),
  country_code char(2) NOT NULL DEFAULT 'IN',
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_lookup_idx
  ON customer_addresses(tenant_id,customer_id,active,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_idx
  ON customer_addresses(tenant_id,customer_id) WHERE active=true AND is_default=true;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES customer_addresses(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_snapshot jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_customer_idempotency_idx
  ON orders(tenant_id,customer_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_snapshot text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_code text;

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
COMMIT;
