-- Fase A: lockdown RLS — cabut akses anon, tulis khusus 3 editor.
-- Editor (update via web): kmdimcc@gmail.com (admin/MCC), kyyaspi13@gmail.com (owner),
--   tenkokmdi@gmail.com (tenko). Guard di DB via auth.jwt email, bukan cuma frontend.
-- Baca: semua user login (authenticated). Anon: tidak bisa apa-apa (wajib login).
-- Sync Sheet → Supabase tetap jalan via edge function (service_role, bypass RLS).
--
-- Cara pakai: Supabase Dashboard → SQL Editor → paste seluruh file → RUN.
-- Idempotent: aman dijalankan ulang (drop semua policy lama dulu, lalu buat ulang).

-- ── 0. Bersih-bersih: drop SEMUA policy lama di tabel operasional ──────────────
-- (termasuk yang dibuat manual via dashboard dan tidak tercodify di repo)
DO $$
DECLARE
  t text;
  r record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leadtimes', 'driver_training_monthly', 'tenko', 'trips', 'drivers',
    'p2h', 'eco_driving_violations', 'kr_reports',
    'kr_loading_units', 'driver_coaching_sessions',
    'trip_cancel_evaluations', 'tenko_tensi_evidence'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END
$$;

-- ── 1. trips ───────────────────────────────────────────────────────────────────
CREATE POLICY "trips_auth_select" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "trips_editor_insert" ON public.trips FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "trips_editor_update" ON public.trips FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "trips_editor_delete" ON public.trips FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 2. drivers ─────────────────────────────────────────────────────────────────
CREATE POLICY "drivers_auth_select" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_editor_insert" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "drivers_editor_update" ON public.drivers FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "drivers_editor_delete" ON public.drivers FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 3. p2h: isi khusus checker + 3 editor, akun lain read-only ────────────────
-- Akun checker: ganti 'checker@kmdi.co.id' dengan email asli akun checker lapangan.
CREATE POLICY "p2h_auth_select" ON public.p2h FOR SELECT TO authenticated USING (true);
CREATE POLICY "p2h_editor_insert" ON public.p2h FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com', 'checker@kmdi.co.id'));
CREATE POLICY "p2h_editor_update" ON public.p2h FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com', 'checker@kmdi.co.id'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com', 'checker@kmdi.co.id'));
CREATE POLICY "p2h_editor_delete" ON public.p2h FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 4. leadtimes ───────────────────────────────────────────────────────────────
CREATE POLICY "leadtimes_auth_select" ON public.leadtimes FOR SELECT TO authenticated USING (true);
CREATE POLICY "leadtimes_editor_insert" ON public.leadtimes FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "leadtimes_editor_update" ON public.leadtimes FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "leadtimes_editor_delete" ON public.leadtimes FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 5. tenko: baca semua login, update khusus editor, TANPA insert/delete web ──
-- (isi tenko murni dari sync service_role; web cuma update kolom tensi_faktor)
CREATE POLICY "tenko_auth_select" ON public.tenko FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenko_editor_update" ON public.tenko FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 6. RPC tenko: cek email penelepon + kembalikan id saja (bukan RETURNING *) ──
CREATE OR REPLACE FUNCTION update_tenko_tensi_faktor(
  p_id text DEFAULT NULL,
  p_tanggal date DEFAULT NULL,
  p_timestamp text DEFAULT NULL,
  p_nama_driver text DEFAULT NULL,
  p_nik text DEFAULT NULL,
  p_tensi_faktor text DEFAULT NULL,
  p_tensi_keterangan text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := (auth.jwt() ->> 'email');
  v_id uuid;
BEGIN
  IF v_email NOT IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com') THEN
    RAISE EXCEPTION 'Forbidden: hanya tim tenko/admin/owner' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NOT NULL AND btrim(p_id) <> '' THEN
    UPDATE tenko
    SET
      tensi_faktor = p_tensi_faktor,
      tensi_keterangan = p_tensi_keterangan
    WHERE id::text = p_id
    RETURNING id INTO v_id;

    IF FOUND THEN
      RETURN v_id;
    END IF;
  END IF;

  UPDATE tenko
  SET
    tensi_faktor = p_tensi_faktor,
    tensi_keterangan = p_tensi_keterangan
  WHERE tanggal = p_tanggal
    AND timestamp = p_timestamp
    AND (
      (p_nama_driver IS NOT NULL AND nama_driver = p_nama_driver)
      OR (p_nik IS NOT NULL AND nik = p_nik)
    )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenko_tensi_faktor(text, date, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenko_tensi_faktor(text, date, text, text, text, text, text) TO authenticated;

-- ── 7. eco_driving_violations ──────────────────────────────────────────────────
CREATE POLICY "eco_auth_select" ON public.eco_driving_violations FOR SELECT TO authenticated USING (true);
CREATE POLICY "eco_editor_insert" ON public.eco_driving_violations FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "eco_editor_update" ON public.eco_driving_violations FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "eco_editor_delete" ON public.eco_driving_violations FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 8. kr_reports ──────────────────────────────────────────────────────────────
CREATE POLICY "kr_reports_auth_select" ON public.kr_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "kr_reports_editor_insert" ON public.kr_reports FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "kr_reports_editor_update" ON public.kr_reports FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "kr_reports_editor_delete" ON public.kr_reports FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 9. kr_loading_units ────────────────────────────────────────────────────────
CREATE POLICY "kr_loading_auth_select" ON public.kr_loading_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "kr_loading_editor_insert" ON public.kr_loading_units FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "kr_loading_editor_update" ON public.kr_loading_units FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "kr_loading_editor_delete" ON public.kr_loading_units FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 10. driver_training_monthly ────────────────────────────────────────────────
CREATE POLICY "training_auth_select" ON public.driver_training_monthly FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_editor_insert" ON public.driver_training_monthly FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "training_editor_update" ON public.driver_training_monthly FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "training_editor_delete" ON public.driver_training_monthly FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 11. driver_coaching_sessions ───────────────────────────────────────────────
CREATE POLICY "coaching_auth_select" ON public.driver_coaching_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "coaching_editor_insert" ON public.driver_coaching_sessions FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "coaching_editor_update" ON public.driver_coaching_sessions FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "coaching_editor_delete" ON public.driver_coaching_sessions FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 12. trip_cancel_evaluations: baca login, tulis 3 editor ────────────────────
CREATE POLICY "trip_cancel_auth_select" ON public.trip_cancel_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "trip_cancel_editor_insert" ON public.trip_cancel_evaluations FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "trip_cancel_editor_update" ON public.trip_cancel_evaluations FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "trip_cancel_editor_delete" ON public.trip_cancel_evaluations FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 13. tenko_tensi_evidence: baca login, tulis 3 editor ───────────────────────
CREATE POLICY "tenko_evidence_auth_select" ON public.tenko_tensi_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenko_evidence_editor_insert" ON public.tenko_tensi_evidence FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "tenko_evidence_editor_update" ON public.tenko_tensi_evidence FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
CREATE POLICY "tenko_evidence_editor_delete" ON public.tenko_tensi_evidence FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

-- ── 14. storage tenko-evidence: tulis 3 editor (sebelumnya cuma kmdimcc+owner) ──
DROP POLICY IF EXISTS "tenko_evidence_admin_insert" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

DROP POLICY IF EXISTS "tenko_evidence_admin_update" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));

DROP POLICY IF EXISTS "tenko_evidence_admin_delete" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com', 'tenkokmdi@gmail.com'));
