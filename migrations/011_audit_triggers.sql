CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_id UUID;
  v_old_val JSONB;
  v_new_val JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_old_val := to_jsonb(OLD);
    v_new_val := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    v_old_val := NULL;
    v_new_val := to_jsonb(NEW);
  ELSE
    v_entity_id := NEW.id;
    v_old_val := to_jsonb(OLD);
    v_new_val := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value)
  VALUES (TG_TABLE_NAME, v_entity_id, TG_OP, v_old_val, v_new_val);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_audit_purchase_requisitions
  AFTER INSERT OR UPDATE OR DELETE ON purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_goods_receipt_notes
  AFTER INSERT OR UPDATE OR DELETE ON goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_rma_requests
  AFTER INSERT OR UPDATE OR DELETE ON rma_requests
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_vendor_claims
  AFTER INSERT OR UPDATE OR DELETE ON vendor_claims
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_warehouse_transfers
  AFTER INSERT OR UPDATE OR DELETE ON warehouse_transfers
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_cycle_counts
  AFTER INSERT OR UPDATE OR DELETE ON cycle_counts
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
