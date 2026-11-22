BEGIN;

CREATE TABLE IF NOT EXISTS inventory_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 code text NOT NULL,
 name text NOT NULL,
 location_type text NOT NULL DEFAULT 'WAREHOUSE' CHECK(location_type IN ('WAREHOUSE','MILL','STORE','TRANSIT','QUARANTINE')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,code)
);

INSERT INTO inventory_locations(tenant_id,code,name,location_type)
SELECT DISTINCT tenant_id,'MAIN','Main warehouse','WAREHOUSE' FROM inventory_lots
ON CONFLICT(tenant_id,code) DO NOTHING;

ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS quantity_reserved numeric(12,3) NOT NULL DEFAULT 0 CHECK(quantity_reserved>=0);
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS quantity_on_hand numeric(12,3);
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES inventory_locations(id);
UPDATE inventory_lots SET quantity_on_hand=quantity_available+quantity_reserved WHERE quantity_on_hand IS NULL;
UPDATE inventory_lots il SET location_id=l.id FROM inventory_locations l WHERE l.tenant_id=il.tenant_id AND l.code='MAIN' AND il.location_id IS NULL;
ALTER TABLE inventory_lots ALTER COLUMN quantity_on_hand SET NOT NULL;
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_balance_check;
ALTER TABLE inventory_lots ADD CONSTRAINT inventory_lots_balance_check CHECK(quantity_on_hand>=0 AND quantity_reserved>=0 AND quantity_available>=0 AND quantity_available+quantity_reserved=quantity_on_hand);
CREATE INDEX IF NOT EXISTS inventory_lots_location_idx ON inventory_lots(tenant_id,location_id,status,received_at);

CREATE TABLE IF NOT EXISTS inventory_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 lot_id uuid NOT NULL REFERENCES inventory_lots(id),
 product_id uuid NOT NULL REFERENCES products(id),
 location_id uuid REFERENCES inventory_locations(id),
 event_type text NOT NULL CHECK(event_type IN ('OPENING','RECEIPT','ADJUSTMENT_IN','ADJUSTMENT_OUT','RESERVE','RELEASE','TRANSFER_IN','TRANSFER_OUT','QUALITY_HOLD','QUALITY_RELEASE','RECALL')),
 quantity_on_hand_delta numeric(12,3) NOT NULL DEFAULT 0,
 quantity_reserved_delta numeric(12,3) NOT NULL DEFAULT 0,
 quantity_available_delta numeric(12,3) NOT NULL DEFAULT 0,
 reference_type text,
 reference_id text,
 reason text NOT NULL CHECK(length(trim(reason))>=3),
 actor_id uuid NOT NULL REFERENCES users(id),
 correlation_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_ledger_tenant_lot_idx ON inventory_ledger(tenant_id,lot_id,created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_ledger_tenant_product_idx ON inventory_ledger(tenant_id,product_id,created_at DESC);

INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,quantity_on_hand_delta,quantity_available_delta,reference_type,reference_id,reason,actor_id,correlation_id)
SELECT il.tenant_id,il.id,il.product_id,il.location_id,'OPENING',il.quantity_on_hand,il.quantity_available,'migration','0006','Opening balance carried forward',u.id,'migration-0006'
FROM inventory_lots il JOIN LATERAL (SELECT u.id FROM users u WHERE u.tenant_id=il.tenant_id ORDER BY u.created_at,u.id LIMIT 1) u ON true
WHERE NOT EXISTS(SELECT 1 FROM inventory_ledger x WHERE x.lot_id=il.id AND x.event_type='OPENING');

CREATE TABLE IF NOT EXISTS inventory_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 reservation_number text NOT NULL,
 reference_type text NOT NULL CHECK(reference_type IN ('ORDER','PROCESSING_JOB','MANUAL')),
 reference_id text,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RELEASED','CONSUMED','CANCELLED')),
 idempotency_key text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),
 released_by uuid REFERENCES users(id),
 release_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz,
 UNIQUE(tenant_id,reservation_number),
 UNIQUE(tenant_id,created_by,idempotency_key)
);
CREATE TABLE IF NOT EXISTS inventory_reservation_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 reservation_id uuid NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
 lot_id uuid NOT NULL REFERENCES inventory_lots(id),
 product_id uuid NOT NULL REFERENCES products(id),
 quantity numeric(12,3) NOT NULL CHECK(quantity>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_reservation_items_lot_idx ON inventory_reservation_items(tenant_id,lot_id);

COMMIT;