BEGIN;
ALTER TABLE inventory_ledger DROP CONSTRAINT IF EXISTS inventory_ledger_event_type_check;
ALTER TABLE inventory_ledger ADD CONSTRAINT inventory_ledger_event_type_check CHECK(event_type IN ('OPENING','RECEIPT','ADJUSTMENT_IN','ADJUSTMENT_OUT','RESERVE','RELEASE','CONSUME','TRANSFER_IN','TRANSFER_OUT','QUALITY_HOLD','QUALITY_RELEASE','RECALL'));

INSERT INTO inventory_locations(tenant_id,code,name,location_type)
SELECT id,'MAIN','Main warehouse','WAREHOUSE' FROM tenants
ON CONFLICT(tenant_id,code) DO NOTHING;
UPDATE inventory_lots il SET location_id=l.id FROM inventory_locations l WHERE l.tenant_id=il.tenant_id AND l.code='MAIN' AND il.location_id IS NULL;
ALTER TABLE inventory_lots ALTER COLUMN location_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 transfer_number text NOT NULL,
 lot_id uuid NOT NULL REFERENCES inventory_lots(id),
 from_location_id uuid NOT NULL REFERENCES inventory_locations(id),
 to_location_id uuid NOT NULL REFERENCES inventory_locations(id),
 quantity numeric(12,3) NOT NULL CHECK(quantity>0),
 reason text NOT NULL CHECK(length(trim(reason))>=5),
 status text NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED','CANCELLED')),
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,transfer_number),
 CHECK(from_location_id<>to_location_id)
);
CREATE INDEX IF NOT EXISTS inventory_transfers_tenant_time_idx ON inventory_transfers(tenant_id,created_at DESC);
COMMIT;
