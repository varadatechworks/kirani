BEGIN;
ALTER TABLE loyalty_policies ADD COLUMN IF NOT EXISTS expiry_days integer CHECK(expiry_days IS NULL OR expiry_days BETWEEN 1 AND 3650);
CREATE TABLE IF NOT EXISTS loyalty_point_lots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 account_id uuid NOT NULL REFERENCES loyalty_accounts(id),source_ledger_id uuid NOT NULL UNIQUE REFERENCES loyalty_ledger(id),
 points_earned bigint NOT NULL CHECK(points_earned>0),points_remaining bigint NOT NULL CHECK(points_remaining>=0 AND points_remaining<=points_earned),
 point_value_paise_snapshot integer NOT NULL CHECK(point_value_paise_snapshot>0),
 expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_point_lots_expiry_idx ON loyalty_point_lots(tenant_id,account_id,expires_at,created_at) WHERE points_remaining>0;
INSERT INTO loyalty_point_lots(tenant_id,account_id,source_ledger_id,points_earned,points_remaining,point_value_paise_snapshot,expires_at,created_at)
SELECT l.tenant_id,l.account_id,l.id,l.points_delta,l.points_delta,l.point_value_paise_snapshot,
 CASE WHEN p.expiry_days IS NULL THEN NULL ELSE l.created_at+make_interval(days=>p.expiry_days) END,l.created_at
FROM loyalty_ledger l LEFT JOIN loyalty_policies p ON p.id=l.policy_id AND p.tenant_id=l.tenant_id
WHERE l.entry_type='EARN' AND l.points_delta>0
ON CONFLICT(source_ledger_id) DO NOTHING;
DO $$
DECLARE ev record; lot record; remaining bigint; take_points bigint;
BEGIN
 FOR ev IN SELECT account_id,abs(points_delta)::bigint AS points FROM loyalty_ledger WHERE entry_type IN ('REDEEM','REVERSAL','EXPIRY') AND points_delta<0 ORDER BY created_at,id LOOP
  remaining:=ev.points;
  FOR lot IN SELECT id,points_remaining FROM loyalty_point_lots WHERE account_id=ev.account_id AND points_remaining>0 ORDER BY expires_at NULLS LAST,created_at,id FOR UPDATE LOOP
   EXIT WHEN remaining=0;
   take_points:=LEAST(remaining,lot.points_remaining);
   UPDATE loyalty_point_lots SET points_remaining=points_remaining-take_points WHERE id=lot.id;
   remaining:=remaining-take_points;
  END LOOP;
 END LOOP;
END $$;
COMMIT;
