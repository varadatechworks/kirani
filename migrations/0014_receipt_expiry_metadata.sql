BEGIN;
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS expires_on date;
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS best_before date;
ALTER TABLE goods_receipt_items ADD CONSTRAINT goods_receipt_item_expiry_order_check CHECK(expires_on IS NULL OR best_before IS NULL OR best_before<=expires_on);
COMMIT;
