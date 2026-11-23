-- The giveaway audit log is append-only: nobody (including the app) can edit or erase history.
CREATE OR REPLACE FUNCTION giveaway_audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'giveaway_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER giveaway_audit_log_no_update
  BEFORE UPDATE OR DELETE ON giveaway_audit_log
  FOR EACH ROW EXECUTE FUNCTION giveaway_audit_log_immutable();
--> statement-breakpoint
CREATE TRIGGER giveaway_audit_log_no_truncate
  BEFORE TRUNCATE ON giveaway_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION giveaway_audit_log_immutable();
--> statement-breakpoint
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
