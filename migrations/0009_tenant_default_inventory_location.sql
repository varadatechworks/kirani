BEGIN;
CREATE OR REPLACE FUNCTION ensure_tenant_main_inventory_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO inventory_locations(tenant_id,code,name,location_type)
 VALUES(NEW.id,'MAIN','Main warehouse','WAREHOUSE')
 ON CONFLICT(tenant_id,code) DO NOTHING;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tenants_default_inventory_location ON tenants;
CREATE TRIGGER tenants_default_inventory_location
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION ensure_tenant_main_inventory_location();

INSERT INTO inventory_locations(tenant_id,code,name,location_type)
SELECT id,'MAIN','Main warehouse','WAREHOUSE' FROM tenants
ON CONFLICT(tenant_id,code) DO NOTHING;
COMMIT;
