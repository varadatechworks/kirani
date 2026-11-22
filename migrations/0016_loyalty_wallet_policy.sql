BEGIN;
CREATE TABLE IF NOT EXISTS loyalty_policies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 version integer NOT NULL CHECK(version>0),effective_from date NOT NULL,effective_to date,
 points_per_rupee integer NOT NULL CHECK(points_per_rupee BETWEEN 0 AND 1000),
 point_value_paise integer NOT NULL CHECK(point_value_paise BETWEEN 1 AND 100000),
 redemption_cap_bps integer NOT NULL DEFAULT 2000 CHECK(redemption_cap_bps BETWEEN 0 AND 10000),
 minimum_redemption_points integer NOT NULL DEFAULT 1 CHECK(minimum_redemption_points>0),
 maximum_redemption_points integer CHECK(maximum_redemption_points IS NULL OR maximum_redemption_points>=minimum_redemption_points),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,version),CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE INDEX IF NOT EXISTS loyalty_policy_effective_idx ON loyalty_policies(tenant_id,status,effective_from,effective_to);
CREATE TABLE IF NOT EXISTS loyalty_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),customer_id uuid NOT NULL REFERENCES users(id),
 points_balance bigint NOT NULL DEFAULT 0 CHECK(points_balance>=0),lifetime_earned bigint NOT NULL DEFAULT 0 CHECK(lifetime_earned>=0),
 lifetime_redeemed bigint NOT NULL DEFAULT 0 CHECK(lifetime_redeemed>=0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,customer_id)
);
CREATE TABLE IF NOT EXISTS loyalty_redemptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),account_id uuid NOT NULL REFERENCES loyalty_accounts(id),
 order_id uuid NOT NULL REFERENCES orders(id),policy_id uuid NOT NULL REFERENCES loyalty_policies(id),
 idempotency_key text NOT NULL,points_redeemed bigint NOT NULL CHECK(points_redeemed>0),
 point_value_paise integer NOT NULL CHECK(point_value_paise>0),discount_minor bigint NOT NULL CHECK(discount_minor>0),
 status text NOT NULL DEFAULT 'APPLIED' CHECK(status IN ('APPLIED','REVERSED')),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),reversed_at timestamptz,reverse_reason text,
 UNIQUE(tenant_id,created_by,idempotency_key)
);
CREATE TABLE IF NOT EXISTS loyalty_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),account_id uuid NOT NULL REFERENCES loyalty_accounts(id),
 policy_id uuid REFERENCES loyalty_policies(id),entry_type text NOT NULL CHECK(entry_type IN ('EARN','REDEEM','REVERSAL','ADJUSTMENT','EXPIRY')),
 points_delta bigint NOT NULL CHECK(points_delta<>0),balance_after bigint NOT NULL CHECK(balance_after>=0),
 point_value_paise_snapshot integer NOT NULL CHECK(point_value_paise_snapshot>0),
 reference_type text NOT NULL,reference_id uuid,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_earn_once_idx ON loyalty_ledger(tenant_id,reference_type,reference_id,entry_type) WHERE entry_type='EARN' AND reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS loyalty_ledger_account_time_idx ON loyalty_ledger(tenant_id,account_id,created_at DESC);
CREATE OR REPLACE FUNCTION reject_loyalty_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'loyalty_ledger is append-only; insert a compensating event instead' USING ERRCODE='55000'; END;
$$;
DROP TRIGGER IF EXISTS loyalty_ledger_no_update ON loyalty_ledger;
DROP TRIGGER IF EXISTS loyalty_ledger_no_delete ON loyalty_ledger;
CREATE TRIGGER loyalty_ledger_no_update BEFORE UPDATE ON loyalty_ledger FOR EACH ROW EXECUTE FUNCTION reject_loyalty_ledger_mutation();
CREATE TRIGGER loyalty_ledger_no_delete BEFORE DELETE ON loyalty_ledger FOR EACH ROW EXECUTE FUNCTION reject_loyalty_ledger_mutation();
COMMIT;
