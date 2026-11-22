BEGIN;
CREATE TABLE IF NOT EXISTS payment_transactions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 order_id uuid NOT NULL REFERENCES orders(id),method text NOT NULL CHECK(method IN ('UPI','BANK_TRANSFER','CARD_EXTERNAL','COD','CASH')),
 external_reference text NOT NULL CHECK(length(trim(external_reference)) BETWEEN 3 AND 160),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),currency char(3) NOT NULL DEFAULT 'INR',
 status text NOT NULL DEFAULT 'CAPTURED' CHECK(status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED')),
 recorded_by uuid NOT NULL REFERENCES users(id),recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,method,external_reference)
);
CREATE INDEX IF NOT EXISTS payment_transactions_order_idx ON payment_transactions(tenant_id,order_id,recorded_at DESC);
CREATE TABLE IF NOT EXISTS payment_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 order_id uuid NOT NULL REFERENCES orders(id),payment_transaction_id uuid NOT NULL REFERENCES payment_transactions(id),
 entry_type text NOT NULL CHECK(entry_type IN ('CAPTURE','REFUND')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),external_reference text NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason))>=3),actor_id uuid NOT NULL REFERENCES users(id),
 correlation_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,entry_type,external_reference)
);
CREATE INDEX IF NOT EXISTS payment_ledger_order_idx ON payment_ledger(tenant_id,order_id,created_at);
CREATE TABLE IF NOT EXISTS refund_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 refund_number text NOT NULL,order_id uuid NOT NULL REFERENCES orders(id),
 payment_transaction_id uuid NOT NULL REFERENCES payment_transactions(id),
 requested_by uuid NOT NULL REFERENCES users(id),amount_minor bigint NOT NULL CHECK(amount_minor>0),
 reason text NOT NULL CHECK(length(trim(reason))>=5),
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','APPROVED','REJECTED','PROCESSED')),
 decision_by uuid REFERENCES users(id),decision_reason text,external_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),processed_at timestamptz,
 UNIQUE(tenant_id,refund_number),UNIQUE(tenant_id,external_reference)
);
CREATE INDEX IF NOT EXISTS refund_requests_queue_idx ON refund_requests(tenant_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS farmer_payables(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 farmer_id uuid NOT NULL REFERENCES users(id),procurement_order_id uuid NOT NULL REFERENCES procurement_orders(id),
 goods_receipt_item_id uuid NOT NULL UNIQUE REFERENCES goods_receipt_items(id),
 quantity_accepted numeric(12,3) NOT NULL CHECK(quantity_accepted>0),
 gross_minor bigint NOT NULL CHECK(gross_minor>=0),deduction_minor bigint NOT NULL DEFAULT 0 CHECK(deduction_minor>=0),
 net_minor bigint NOT NULL CHECK(net_minor>=0 AND net_minor=gross_minor-deduction_minor),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_SETTLEMENT','SETTLED','ON_HOLD')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farmer_payables_farmer_idx ON farmer_payables(tenant_id,farmer_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS farmer_payable_adjustments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 payable_id uuid NOT NULL REFERENCES farmer_payables(id),amount_minor bigint NOT NULL CHECK(amount_minor>0),
 reason text NOT NULL CHECK(length(trim(reason))>=5),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS farmer_settlement_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 settlement_number text NOT NULL,farmer_id uuid NOT NULL REFERENCES users(id),
 gross_minor bigint NOT NULL CHECK(gross_minor>=0),deduction_minor bigint NOT NULL CHECK(deduction_minor>=0),
 net_minor bigint NOT NULL CHECK(net_minor=gross_minor-deduction_minor AND net_minor>0),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','PAID','CANCELLED')),
 created_by uuid NOT NULL REFERENCES users(id),approved_by uuid REFERENCES users(id),paid_by uuid REFERENCES users(id),
 bank_reference text,created_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz,paid_at timestamptz,
 UNIQUE(tenant_id,settlement_number),UNIQUE(tenant_id,bank_reference)
);
CREATE TABLE IF NOT EXISTS farmer_settlement_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 settlement_id uuid NOT NULL REFERENCES farmer_settlement_batches(id),payable_id uuid NOT NULL REFERENCES farmer_payables(id),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),UNIQUE(tenant_id,payable_id)
);
CREATE INDEX IF NOT EXISTS farmer_settlement_farmer_idx ON farmer_settlement_batches(tenant_id,farmer_id,created_at DESC);

CREATE OR REPLACE FUNCTION reject_payment_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'payment_ledger is append-only; insert a compensating event instead' USING ERRCODE='55000'; END;
$$;
DROP TRIGGER IF EXISTS payment_ledger_no_update ON payment_ledger;
DROP TRIGGER IF EXISTS payment_ledger_no_delete ON payment_ledger;
CREATE TRIGGER payment_ledger_no_update BEFORE UPDATE ON payment_ledger FOR EACH ROW EXECUTE FUNCTION reject_payment_ledger_mutation();
CREATE TRIGGER payment_ledger_no_delete BEFORE DELETE ON payment_ledger FOR EACH ROW EXECUTE FUNCTION reject_payment_ledger_mutation();
COMMIT;
