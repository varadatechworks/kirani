BEGIN;

CREATE TABLE IF NOT EXISTS farmer_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 farmer_id uuid NOT NULL REFERENCES users(id),
 farm_name text NOT NULL CHECK(length(trim(farm_name)) BETWEEN 2 AND 160),
 farm_type text NOT NULL DEFAULT 'INDIVIDUAL' CHECK(farm_type IN ('INDIVIDUAL','FPO','COOPERATIVE','COMPANY')),
 village text NOT NULL CHECK(length(trim(village)) BETWEEN 2 AND 120),
 taluk text,
 district text NOT NULL CHECK(length(trim(district)) BETWEEN 2 AND 120),
 state text NOT NULL CHECK(length(trim(state)) BETWEEN 2 AND 100),
 postal_code text NOT NULL CHECK(postal_code ~ '^[0-9]{6}$'),
 farm_area numeric(12,3) CHECK(farm_area IS NULL OR farm_area>0),
 farm_area_unit text NOT NULL DEFAULT 'ACRE' CHECK(farm_area_unit IN ('ACRE','HECTARE')),
 verification_status text NOT NULL DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
 verification_note text,
 verified_by uuid REFERENCES users(id),
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,farmer_id)
);
CREATE INDEX IF NOT EXISTS farmer_profiles_tenant_status_idx ON farmer_profiles(tenant_id,verification_status,created_at DESC);

ALTER TABLE farmer_listings ADD COLUMN IF NOT EXISTS allocated_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(allocated_quantity>=0);
ALTER TABLE farmer_listings DROP CONSTRAINT IF EXISTS farmer_listings_allocation_limit;
ALTER TABLE farmer_listings ADD CONSTRAINT farmer_listings_allocation_limit CHECK(allocated_quantity<=available_quantity);

CREATE TABLE IF NOT EXISTS procurement_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 po_number text NOT NULL,
 farmer_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','ACCEPTED','REJECTED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
 expected_delivery_date date NOT NULL,
 response_note text,
 created_by uuid NOT NULL REFERENCES users(id),
 responded_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,po_number)
);
CREATE INDEX IF NOT EXISTS procurement_orders_farmer_idx ON procurement_orders(tenant_id,farmer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS procurement_orders_status_idx ON procurement_orders(tenant_id,status,expected_delivery_date);

CREATE TABLE IF NOT EXISTS procurement_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 procurement_order_id uuid NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
 listing_id uuid NOT NULL REFERENCES farmer_listings(id),
 product_id uuid NOT NULL REFERENCES products(id),
 quantity_ordered numeric(12,3) NOT NULL CHECK(quantity_ordered>0),
 quantity_accepted numeric(12,3) CHECK(quantity_accepted IS NULL OR (quantity_accepted>0 AND quantity_accepted<=quantity_ordered)),
 unit_code text NOT NULL,
 unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),
 line_total_minor bigint NOT NULL CHECK(line_total_minor>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(procurement_order_id,listing_id)
);
CREATE INDEX IF NOT EXISTS procurement_items_order_idx ON procurement_order_items(tenant_id,procurement_order_id);
COMMIT;
