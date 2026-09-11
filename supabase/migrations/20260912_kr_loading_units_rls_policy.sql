-- RLS untuk kr_loading_units — ikut pola kr_reports
ALTER TABLE kr_loading_units ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON kr_loading_units TO authenticated;

DROP POLICY IF EXISTS "kr_loading_units_authenticated_select" ON kr_loading_units;
CREATE POLICY "kr_loading_units_authenticated_select"
  ON kr_loading_units FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kr_loading_units_authenticated_insert" ON kr_loading_units;
CREATE POLICY "kr_loading_units_authenticated_insert"
  ON kr_loading_units FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "kr_loading_units_authenticated_update" ON kr_loading_units;
CREATE POLICY "kr_loading_units_authenticated_update"
  ON kr_loading_units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kr_loading_units_authenticated_delete" ON kr_loading_units;
CREATE POLICY "kr_loading_units_authenticated_delete"
  ON kr_loading_units FOR DELETE TO authenticated USING (true);
