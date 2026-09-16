-- Izinkan owner (kyyaspi13@gmail.com) sejajar admin (kmdimcc@gmail.com)
-- untuk tulis evaluasi cancel, evidence tensi, dan storage terkait.
-- Sebelumnya policy cuma cek satu email kmdimcc.

-- ── trip_cancel_evaluations ──
DROP POLICY IF EXISTS "trip_cancel_evaluations_admin_insert" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_admin_insert"
  ON trip_cancel_evaluations FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

DROP POLICY IF EXISTS "trip_cancel_evaluations_admin_update" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_admin_update"
  ON trip_cancel_evaluations FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

DROP POLICY IF EXISTS "trip_cancel_evaluations_admin_delete" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_admin_delete"
  ON trip_cancel_evaluations FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

-- ── tenko_tensi_evidence ──
DROP POLICY IF EXISTS "tenko_tensi_evidence_admin_insert" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_admin_insert"
  ON tenko_tensi_evidence FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

DROP POLICY IF EXISTS "tenko_tensi_evidence_admin_update" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_admin_update"
  ON tenko_tensi_evidence FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

DROP POLICY IF EXISTS "tenko_tensi_evidence_admin_delete" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_admin_delete"
  ON tenko_tensi_evidence FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

-- ── storage tenko-evidence ──
DROP POLICY IF EXISTS "tenko_evidence_admin_insert" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

DROP POLICY IF EXISTS "tenko_evidence_admin_update" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'))
  WITH CHECK (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

DROP POLICY IF EXISTS "tenko_evidence_admin_delete" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') IN ('kmdimcc@gmail.com', 'kyyaspi13@gmail.com'));

-- ── user_profiles: owner bisa baca semua profil (buat halaman Kelola User) ──
DROP POLICY IF EXISTS "user_profiles_owner_read_all" ON user_profiles;
CREATE POLICY "user_profiles_owner_read_all"
  ON user_profiles FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'kyyaspi13@gmail.com');
