-- Auto-coaching sessions: 1 violation → 1 coaching session (coached_by = 'AUTO')
CREATE TABLE IF NOT EXISTS driver_coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  violation_id bigint,
  violation_date date NOT NULL,
  coached_by text DEFAULT 'AUTO',
  notes text DEFAULT '',
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN driver_coaching_sessions.violation_id IS 'ID pelanggaran dari eco_driving_violations (tanpa FK, karena tabel sumber tidak punya unique constraint)';

CREATE INDEX IF NOT EXISTS idx_coaching_driver_date
  ON driver_coaching_sessions(driver_id, violation_date);
CREATE INDEX IF NOT EXISTS idx_coaching_violation
  ON driver_coaching_sessions(violation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_violation_unique
  ON driver_coaching_sessions(violation_id);

-- Trigger: auto-create coaching record saat violation baru diinsert
CREATE OR REPLACE FUNCTION create_coaching_for_violation()
RETURNS TRIGGER AS $$
DECLARE
  parsed_date date;
BEGIN
  -- Parse "Tanggal" field (format: DD Mon YY) with fallback to CURRENT_DATE
  BEGIN
    parsed_date := TO_DATE(NEW."Tanggal", 'DD Mon YY');
  EXCEPTION WHEN OTHERS THEN
    parsed_date := CURRENT_DATE;
  END;

  INSERT INTO driver_coaching_sessions (driver_id, violation_id, violation_date, coached_by, notes)
  VALUES (NEW.driver_id, NEW.id, parsed_date, 'AUTO', 'Auto coaching: ' || COALESCE(NEW."Jenis Peringatan", 'Eco driving violation'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coaching_after_violation ON eco_driving_violations;
CREATE TRIGGER trg_coaching_after_violation
AFTER INSERT ON eco_driving_violations
FOR EACH ROW
EXECUTE FUNCTION create_coaching_for_violation();
