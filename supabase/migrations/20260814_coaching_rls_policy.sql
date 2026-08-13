-- RLS policies untuk driver_coaching_sessions
-- Tanpa policy ini, Supabase RLS memblokir SELECT/INSERT/DELETE dari user login
-- (error: "new row violates row-level security policy")
--
-- CARA PAKAI:
--   1. Pastikan tabel dibuat dulu: jalankan 20260814_add_coaching_sessions.sql
--   2. Buka Supabase Dashboard -> SQL Editor
--   3. Paste seluruh file ini, lalu RUN
--
-- Idempotent: aman dijalankan berulang kali.

ALTER TABLE driver_coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Fallback: pastikan role authenticated punya privilege tabel
-- (aman dijalankan berulang, tidak menimpa grant yang sudah ada)
GRANT SELECT, INSERT, UPDATE, DELETE ON driver_coaching_sessions TO authenticated;

DROP POLICY IF EXISTS "coaching_authenticated_select" ON driver_coaching_sessions;
CREATE POLICY "coaching_authenticated_select"
  ON driver_coaching_sessions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "coaching_authenticated_insert" ON driver_coaching_sessions;
CREATE POLICY "coaching_authenticated_insert"
  ON driver_coaching_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "coaching_authenticated_delete" ON driver_coaching_sessions;
CREATE POLICY "coaching_authenticated_delete"
  ON driver_coaching_sessions
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "coaching_authenticated_update" ON driver_coaching_sessions;
CREATE POLICY "coaching_authenticated_update"
  ON driver_coaching_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
