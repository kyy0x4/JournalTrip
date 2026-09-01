-- ═══════════════════════════════════════════════════════════════════════════════
-- Fix RLS: tabel yang masih bocor (anon bisa INSERT/UPDATE/DELETE tanpa login).
--
-- Hasil audit (via anon key, tes perilaku):
--   ✅ AMAN : drivers, p2h, trips, eco_driving_violations, tenko,
--             kr_reports, driver_coaching_sessions
--   ⚠️ BOCOR: leadtimes  (INSERT/UPDATE/DELETE anon sukses)
--   ⚠️ RAGU : driver_training_monthly (RLS kemungkinan belum aktif)
--
-- Kebijakan yang dipasang:
--   • anon          → hanya SELECT (baca) — halaman tetap bisa menampilkan data
--   • authenticated → SELECT/INSERT/UPDATE/DELETE penuh
--
-- Cara pakai: jalankan di Supabase Dashboard → SQL Editor.
-- Idempotent: aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. leadtimes (BOCOR — paling penting) ──────────────────────────────────────
ALTER TABLE public.leadtimes ENABLE ROW LEVEL SECURITY;

-- ⚠️ Penting: Supabase otomatis bikin policy bawaan "Enable insert access for
--    service role" (role public) saat tabel dibuat lewat dashboard. Role public
--    itu termasuk anon, jadi policy ini bikin anon BISA INSERT meski RLS aktif.
--    Harus di-drop dulu:
DROP POLICY IF EXISTS "Enable insert access for service role" ON public.leadtimes;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leadtimes TO authenticated;

DROP POLICY IF EXISTS "anon_read_leadtimes" ON public.leadtimes;
CREATE POLICY "anon_read_leadtimes"
  ON public.leadtimes FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "auth_all_leadtimes" ON public.leadtimes;
CREATE POLICY "auth_all_leadtimes"
  ON public.leadtimes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 2. driver_training_monthly (ragu — diamankan sekalian) ─────────────────────
ALTER TABLE public.driver_training_monthly ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_training_monthly TO authenticated;

DROP POLICY IF EXISTS "anon_read_driver_training_monthly" ON public.driver_training_monthly;
CREATE POLICY "anon_read_driver_training_monthly"
  ON public.driver_training_monthly FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "auth_all_driver_training_monthly" ON public.driver_training_monthly;
CREATE POLICY "auth_all_driver_training_monthly"
  ON public.driver_training_monthly FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
