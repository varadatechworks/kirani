BEGIN;
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS expires_on date;
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS best_before date;
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS parent_inventory_lot_id uuid REFERENCES inventory_lots(id);
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_source_xor_check;
ALTER TABLE inventory_lots ADD CONSTRAINT inventory_lots_source_xor_check CHECK(
 (goods_receipt_item_id IS NOT NULL)::int + (processing_output_id IS NOT NULL)::int + (parent_inventory_lot_id IS NOT NULL)::int = 1
);
ALTER TABLE inventory_lots ADD CONSTRAINT inventory_lots_expiry_order_check CHECK(expires_on IS NULL OR best_before IS NULL OR best_before<=expires_on);
ALTER TABLE inventory_transfers ADD COLUMN IF NOT EXISTS destination_lot_id uuid REFERENCES inventory_lots(id);
ALTER TABLE inventory_reservations ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours');
ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_policy text NOT NULL DEFAULT 'FEFO' CHECK(inventory_policy IN ('FIFO','FEFO'));
CREATE INDEX IF NOT EXISTS inventory_lots_expiry_idx ON inventory_lots(tenant_id,product_id,status,expires_on,received_at);
CREATE INDEX IF NOT EXISTS inventory_reservations_expiry_idx ON inventory_reservations(tenant_id,status,expires_at);

CREATE OR REPLACE FUNCTION reject_inventory_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'inventory_ledger is append-only; insert a compensating event instead' USING ERRCODE='55000';
END;
$$;
DROP TRIGGER IF EXISTS inventory_ledger_no_update ON inventory_ledger;
DROP TRIGGER IF EXISTS inventory_ledger_no_delete ON inventory_ledger;
CREATE TRIGGER inventory_ledger_no_update BEFORE UPDATE ON inventory_ledger FOR EACH ROW EXECUTE FUNCTION reject_inventory_ledger_mutation();
CREATE TRIGGER inventory_ledger_no_delete BEFORE DELETE ON inventory_ledger FOR EACH ROW EXECUTE FUNCTION reject_inventory_ledger_mutation();
COMMIT;
