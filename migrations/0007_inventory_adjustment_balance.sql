BEGIN;
-- The legacy lot check treated the original receipt quantity as a permanent ceiling.
-- Inventory adjustments must be able to correct a verified count independently of receipt quantity.
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_check;
COMMIT;
