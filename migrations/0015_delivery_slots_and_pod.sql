BEGIN;
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_status_check;
ALTER TABLE packages ADD CONSTRAINT packages_status_check CHECK(status IN ('PACKED','READY_FOR_DISPATCH','DISPATCHED','PARTIALLY_DELIVERED','DELIVERED','RECALLED','CANCELLED'));
CREATE TABLE IF NOT EXISTS delivery_slots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 slot_code text NOT NULL,delivery_date date NOT NULL,starts_at time NOT NULL,ends_at time NOT NULL,
 capacity integer NOT NULL CHECK(capacity>0),cutoff_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,slot_code,delivery_date),CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS delivery_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 order_id uuid NOT NULL REFERENCES orders(id),slot_id uuid NOT NULL REFERENCES delivery_slots(id),
 operator_id uuid NOT NULL REFERENCES users(id),status text NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','PARTIALLY_DELIVERED','FAILED','REFUSED','CANCELLED')),
 assigned_by uuid NOT NULL REFERENCES users(id),assigned_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,order_id)
);
CREATE TABLE IF NOT EXISTS delivery_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 assignment_id uuid NOT NULL REFERENCES delivery_assignments(id),
 event_type text NOT NULL CHECK(event_type IN ('ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','PARTIALLY_DELIVERED','FAILED','REFUSED','CANCELLED')),
 latitude numeric(10,7),longitude numeric(10,7),reason text NOT NULL,
 recorded_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE TABLE IF NOT EXISTS delivery_pods(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 assignment_id uuid NOT NULL REFERENCES delivery_assignments(id) UNIQUE,
 outcome text NOT NULL CHECK(outcome IN ('DELIVERED','PARTIAL','FAILED','REFUSED')),
 received_by text,reason text NOT NULL,latitude numeric(10,7) NOT NULL,longitude numeric(10,7) NOT NULL,
 cash_collected numeric(12,2) NOT NULL DEFAULT 0 CHECK(cash_collected>=0),
 proof_reference text,recorded_by uuid NOT NULL REFERENCES users(id),recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(latitude BETWEEN -90 AND 90),CHECK(longitude BETWEEN -180 AND 180)
);
CREATE TABLE IF NOT EXISTS delivery_pod_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 pod_id uuid NOT NULL REFERENCES delivery_pods(id),order_item_id uuid NOT NULL REFERENCES order_items(id),
 quantity_ordered numeric(12,3) NOT NULL CHECK(quantity_ordered>0),
 quantity_delivered numeric(12,3) NOT NULL DEFAULT 0 CHECK(quantity_delivered>=0),
 quantity_refused numeric(12,3) NOT NULL DEFAULT 0 CHECK(quantity_refused>=0),
 reason text,CHECK(quantity_delivered+quantity_refused<=quantity_ordered),
 UNIQUE(tenant_id,pod_id,order_item_id)
);
CREATE INDEX IF NOT EXISTS delivery_assignments_operator_idx ON delivery_assignments(tenant_id,operator_id,status,assigned_at DESC);
CREATE INDEX IF NOT EXISTS delivery_events_assignment_idx ON delivery_events(tenant_id,assignment_id,created_at);
COMMIT;
