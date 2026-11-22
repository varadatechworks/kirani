BEGIN;
CREATE TABLE IF NOT EXISTS packages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 package_number text NOT NULL,public_token uuid NOT NULL DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orders(id),status text NOT NULL DEFAULT 'PACKED' CHECK(status IN ('PACKED','READY_FOR_DISPATCH','DISPATCHED','DELIVERED','RECALLED','CANCELLED')),
 packed_by uuid NOT NULL REFERENCES users(id),packed_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,package_number),UNIQUE(public_token)
);
CREATE TABLE IF NOT EXISTS package_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),package_id uuid NOT NULL REFERENCES packages(id),
 order_item_id uuid NOT NULL REFERENCES order_items(id),product_id uuid NOT NULL REFERENCES products(id),
 quantity numeric(12,3) NOT NULL CHECK(quantity>0),unit_code text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS package_batch_allocations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),package_item_id uuid NOT NULL REFERENCES package_items(id),
 inventory_lot_id uuid NOT NULL REFERENCES inventory_lots(id),quantity numeric(12,3) NOT NULL CHECK(quantity>0),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,package_item_id,inventory_lot_id)
);
CREATE TABLE IF NOT EXISTS package_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),package_id uuid NOT NULL REFERENCES packages(id),
 event_type text NOT NULL CHECK(event_type IN ('PACKED','READY_FOR_DISPATCH','DISPATCHED','DELIVERED','RECALLED','CANCELLED')),
 reason text NOT NULL CHECK(length(trim(reason))>=3),actor_id uuid NOT NULL REFERENCES users(id),correlation_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS packages_order_idx ON packages(tenant_id,order_id,packed_at DESC);
CREATE INDEX IF NOT EXISTS package_allocations_lot_idx ON package_batch_allocations(tenant_id,inventory_lot_id);
COMMIT;
