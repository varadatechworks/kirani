BEGIN;

-- A rejected delivery may be returned and replaced. Physical received quantity can
-- therefore exceed the PO quantity, but accepted quantity must never exceed it.
ALTER TABLE procurement_order_items
 DROP CONSTRAINT IF EXISTS procurement_receipt_quantity_limit;

ALTER TABLE procurement_order_items
 ADD CONSTRAINT procurement_receipt_quantity_limit
 CHECK (
  quantity_quality_accepted <= COALESCE(quantity_accepted,0)
  AND quantity_quality_accepted + quantity_rejected = quantity_received
 );

COMMIT;
