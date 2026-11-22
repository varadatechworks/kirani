BEGIN;
ALTER TABLE loyalty_policies ADD COLUMN IF NOT EXISTS referral_reward_points integer NOT NULL DEFAULT 0 CHECK(referral_reward_points BETWEEN 0 AND 100000);
ALTER TABLE loyalty_ledger DROP CONSTRAINT IF EXISTS loyalty_ledger_entry_type_check;
ALTER TABLE loyalty_ledger ADD CONSTRAINT loyalty_ledger_entry_type_check CHECK(entry_type IN ('EARN','REDEEM','REVERSAL','ADJUSTMENT','EXPIRY','REFERRAL'));
CREATE TABLE IF NOT EXISTS customer_referral_codes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 owner_id uuid NOT NULL REFERENCES users(id),code text NOT NULL,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,owner_id),UNIQUE(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS customer_referrals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 referral_code_id uuid NOT NULL REFERENCES customer_referral_codes(id),
 referrer_id uuid NOT NULL REFERENCES users(id),referred_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','REWARDED','CANCELLED')),
 qualified_order_id uuid REFERENCES orders(id),created_at timestamptz NOT NULL DEFAULT now(),rewarded_at timestamptz,
 UNIQUE(tenant_id,referred_id),CHECK(referrer_id<>referred_id)
);
CREATE INDEX IF NOT EXISTS customer_referrals_owner_idx ON customer_referrals(tenant_id,referrer_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_referral_reward_once_idx ON loyalty_ledger(tenant_id,reference_type,reference_id,entry_type) WHERE entry_type='REFERRAL' AND reference_id IS NOT NULL;
COMMIT;
