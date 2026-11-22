BEGIN;
ALTER TABLE inventory_lots ALTER COLUMN goods_receipt_item_id DROP NOT NULL;
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS processing_output_id uuid UNIQUE;
ALTER TABLE inventory_lots ADD CONSTRAINT inventory_lots_source_xor_check CHECK ((goods_receipt_item_id IS NOT NULL)::int + (processing_output_id IS NOT NULL)::int = 1);

CREATE TABLE IF NOT EXISTS processing_facilities(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 code text NOT NULL,name text NOT NULL,address text,facility_type text NOT NULL DEFAULT 'MILL' CHECK(facility_type IN ('MILL','PROCESSOR')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','SUSPENDED','REJECTED')),
 variance_tolerance numeric(7,3) NOT NULL DEFAULT 0.500 CHECK(variance_tolerance>=0 AND variance_tolerance<=10),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS processing_facility_users(
 tenant_id uuid NOT NULL REFERENCES tenants(id),facility_id uuid NOT NULL REFERENCES processing_facilities(id),user_id uuid NOT NULL REFERENCES users(id),
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,facility_id,user_id)
);
CREATE TABLE IF NOT EXISTS processing_stage_templates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),facility_id uuid NOT NULL REFERENCES processing_facilities(id),
 code text NOT NULL,name text NOT NULL,sequence_no integer NOT NULL CHECK(sequence_no>0),required boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,facility_id,code),UNIQUE(tenant_id,facility_id,sequence_no)
);
CREATE TABLE IF NOT EXISTS processing_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),job_number text NOT NULL,
 facility_id uuid NOT NULL REFERENCES processing_facilities(id),source_lot_id uuid NOT NULL REFERENCES inventory_lots(id),
 status text NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED','ACCEPTED','MATERIAL_RECEIVED','IN_PROGRESS','QC_PENDING','RECONCILIATION_PENDING','COMPLETED','DISPATCHED_TO_KIRANI','RECEIVED_AND_INSPECTED','REJECTED','CANCELLED')),
 input_quantity numeric(12,3) NOT NULL CHECK(input_quantity>0),unit_code text NOT NULL,process_name text NOT NULL,
 expected_completion date,created_by uuid NOT NULL REFERENCES users(id),accepted_by uuid,accepted_at timestamptz,
 completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,job_number)
);
CREATE TABLE IF NOT EXISTS processing_job_reservations(
 tenant_id uuid NOT NULL REFERENCES tenants(id),job_id uuid NOT NULL REFERENCES processing_jobs(id),reservation_id uuid NOT NULL REFERENCES inventory_reservations(id),
 PRIMARY KEY(tenant_id,job_id)
);
CREATE TABLE IF NOT EXISTS processing_job_stages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),job_id uuid NOT NULL REFERENCES processing_jobs(id),
 template_id uuid REFERENCES processing_stage_templates(id),sequence_no integer NOT NULL,stage_name text NOT NULL,
 machine text,operator_id uuid NOT NULL REFERENCES users(id),input_quantity numeric(12,3) NOT NULL CHECK(input_quantity>0),
 saleable_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(saleable_quantity>=0),byproduct_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(byproduct_quantity>=0),
 waste_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(waste_quantity>=0),loss_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(loss_quantity>=0),
 remaining_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(remaining_quantity>=0),adjustment_quantity numeric(12,3) NOT NULL DEFAULT 0,
 moisture_percent numeric(6,3),started_at timestamptz NOT NULL,ended_at timestamptz NOT NULL,
 qc_status text NOT NULL DEFAULT 'PENDING' CHECK(qc_status IN ('PENDING','PASS','FAIL','DEVIATION')),
 qc_note text,variance numeric(12,3) NOT NULL DEFAULT 0,variance_approved_by uuid,variance_approval_reason text,
 recorded_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,job_id,sequence_no),CHECK(ended_at>=started_at)
);
CREATE TABLE IF NOT EXISTS processing_outputs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),job_id uuid NOT NULL REFERENCES processing_jobs(id),
 stage_id uuid NOT NULL REFERENCES processing_job_stages(id),batch_code text NOT NULL,output_name text NOT NULL,
 output_type text NOT NULL CHECK(output_type IN ('SALEABLE','BYPRODUCT')),quantity numeric(12,3) NOT NULL CHECK(quantity>0),
 unit_code text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,batch_code)
);
CREATE TABLE IF NOT EXISTS processing_output_genealogy(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),output_id uuid NOT NULL REFERENCES processing_outputs(id),
 source_lot_id uuid REFERENCES inventory_lots(id),parent_output_id uuid REFERENCES processing_outputs(id),
 source_quantity numeric(12,3) NOT NULL CHECK(source_quantity>0),
 CHECK((source_lot_id IS NOT NULL)::int + (parent_output_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS processing_genealogy_source_lot_uq ON processing_output_genealogy(tenant_id,output_id,source_lot_id) WHERE source_lot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS processing_genealogy_parent_output_uq ON processing_output_genealogy(tenant_id,output_id,parent_output_id) WHERE parent_output_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS processing_exceptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),job_id uuid NOT NULL REFERENCES processing_jobs(id),
 stage_id uuid REFERENCES processing_job_stages(id),exception_type text NOT NULL,variance numeric(12,3) NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','APPROVED','REJECTED','RESOLVED')),
 reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),resolved_by uuid REFERENCES users(id),resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS processing_jobs_facility_idx ON processing_jobs(tenant_id,facility_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS processing_outputs_job_idx ON processing_outputs(tenant_id,job_id,created_at);
CREATE INDEX IF NOT EXISTS processing_genealogy_lot_idx ON processing_output_genealogy(tenant_id,source_lot_id);
COMMIT;
