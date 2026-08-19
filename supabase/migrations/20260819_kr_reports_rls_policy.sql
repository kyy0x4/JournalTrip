-- RLS policies untuk kr_reports
-- Data diisi via Google Apps Script (menggunakan anon key / service role).
-- Tanpa policy ini, Supabase RLS memblokir SELECT dari user login.
--
-- CARA PAKAI:
--   1. Pastikan tabel dibuat dulu: jalankan 20260819_add_kr_reports.sql
--   2. Buka Supabase Dashboard -> SQL Editor
--   3. Paste seluruh file ini, lalu RUN
--
-- Idempotent: aman dijalankan berulang kali.

ALTER TABLE kr_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON kr_reports TO authenticated;

DROP POLICY IF EXISTS "kr_reports_authenticated_select" ON kr_reports;
CREATE POLICY "kr_reports_authenticated_select"
  ON kr_reports
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kr_reports_authenticated_insert" ON kr_reports;
CREATE POLICY "kr_reports_authenticated_insert"
  ON kr_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "kr_reports_authenticated_update" ON kr_reports;
CREATE POLICY "kr_reports_authenticated_update"
  ON kr_reports
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "kr_reports_authenticated_delete" ON kr_reports;
CREATE POLICY "kr_reports_authenticated_delete"
  ON kr_reports
  FOR DELETE
  TO authenticated
  USING (true);
