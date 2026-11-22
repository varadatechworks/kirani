BEGIN;
ALTER TABLE procurement_order_items ADD COLUMN IF NOT EXISTS quantity_received numeric(12,3) NOT NULL DEFAULT 0 CHECK(quantity_received>=0);
ALTER TABLE procurement_order_items ADD COLUMN IF NOT EXISTS quantity_quality_accepted numeric(12,3) NOT NULL DEFAULT 0 CHECK(quantity_quality_accepted>=0);
ALTER TABLE procurement_order_items ADD COLUMN IF NOT EXISTS quantity_rejected numeric(12,3) NOT NULL DEFAULT 0 CHECK(quantity_rejected>=0);
ALTER TABLE procurement_order_items DROP CONSTRAINT IF EXISTS procurement_receipt_quantity_limit;
ALTER TABLE procurement_order_items ADD CONSTRAINT procurement_receipt_quantity_limit CHECK(quantity_received<=COALESCE(quantity_accepted,0) AND quantity_quality_accepted+quantity_rejected=quantity_received);

CREATE TABLE IF NOT EXISTS goods_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 receipt_number text NOT NULL,
 procurement_order_id uuid NOT NULL REFERENCES procurement_orders(id),
 received_by uuid NOT NULL REFERENCES users(id),
 received_at timestamptz NOT NULL DEFAULT now(),
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,receipt_number)
);
CREATE INDEX IF NOT EXISTS goods_receipts_po_idx ON goods_receipts(tenant_id,procurement_order_id,received_at DESC);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 goods_receipt_id uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
 procurement_order_item_id uuid NOT NULL REFERENCES procurement_order_items(id),
 product_id uuid NOT NULL REFERENCES products(id),
 quantity_received numeric(12,3) NOT NULL CHECK(quantity_received>0),
 quantity_quality_accepted numeric(12,3) NOT NULL CHECK(quantity_quality_accepted>=0),
 quantity_rejected numeric(12,3) NOT NULL CHECK(quantity_rejected>=0),
 rejection_reason text,
 lot_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(quantity_quality_accepted+quantity_rejected=quantity_received),
 CHECK(quantity_rejected=0 OR length(trim(COALESCE(rejection_reason,'')))>=3)
);
CREATE INDEX IF NOT EXISTS goods_receipt_items_receipt_idx ON goods_receipt_items(tenant_id,goods_receipt_id);

CREATE TABLE IF NOT EXISTS inventory_lots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 product_id uuid NOT NULL REFERENCES products(id),
 goods_receipt_item_id uuid NOT NULL UNIQUE REFERENCES goods_receipt_items(id),
 lot_code text NOT NULL,
 quantity_received numeric(12,3) NOT NULL CHECK(quantity_received>0),
 quantity_available numeric(12,3) NOT NULL CHECK(quantity_available>=0 AND quantity_available<=quantity_received),
 status text NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','QUARANTINED','DEPLETED','RECALLED')),
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,lot_code)
);
CREATE INDEX IF NOT EXISTS inventory_lots_stock_idx ON inventory_lots(tenant_id,product_id,status,received_at);
COMMIT;
