BEGIN;
CREATE TABLE IF NOT EXISTS inventory_recalls(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 recall_number text NOT NULL,source_lot_id uuid NOT NULL REFERENCES inventory_lots(id),
 reason text NOT NULL CHECK(length(trim(reason))>=5),status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 closed_by uuid REFERENCES users(id),closed_at timestamptz,close_reason text,
 UNIQUE(tenant_id,recall_number)
);
CREATE TABLE IF NOT EXISTS inventory_recall_lots(
 tenant_id uuid NOT NULL REFERENCES tenants(id),recall_id uuid NOT NULL REFERENCES inventory_recalls(id),
 inventory_lot_id uuid NOT NULL REFERENCES inventory_lots(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,recall_id,inventory_lot_id)
);
CREATE TABLE IF NOT EXISTS inventory_recall_packages(
 tenant_id uuid NOT NULL REFERENCES tenants(id),recall_id uuid NOT NULL REFERENCES inventory_recalls(id),
 package_id uuid NOT NULL REFERENCES packages(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,recall_id,package_id)
);
CREATE INDEX IF NOT EXISTS inventory_recalls_tenant_time_idx ON inventory_recalls(tenant_id,created_at DESC);
COMMIT;
