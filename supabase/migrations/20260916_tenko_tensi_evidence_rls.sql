-- RLS tenko_tensi_evidence: baca publik (anon + login), tulis khusus admin kmdimcc.
-- Guard di DB via auth.jwt email — bukan cuma di frontend.
ALTER TABLE tenko_tensi_evidence ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON tenko_tensi_evidence TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON tenko_tensi_evidence TO authenticated;

DROP POLICY IF EXISTS "tenko_tensi_evidence_public_select" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_public_select"
  ON tenko_tensi_evidence FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tenko_tensi_evidence_admin_insert" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_admin_insert"
  ON tenko_tensi_evidence FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

DROP POLICY IF EXISTS "tenko_tensi_evidence_admin_update" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_admin_update"
  ON tenko_tensi_evidence FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

DROP POLICY IF EXISTS "tenko_tensi_evidence_admin_delete" ON tenko_tensi_evidence;
CREATE POLICY "tenko_tensi_evidence_admin_delete"
  ON tenko_tensi_evidence FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

-- Bucket storage tenko-evidence (jalankan sekali di Dashboard → SQL Editor):
--   insert into storage.buckets (id, name, public) values ('tenko-evidence', 'tenko-evidence', true)
--   on conflict (id) do nothing;
--
-- Policy storage: baca publik, upload/update/delete khusus admin kmdimcc.
DROP POLICY IF EXISTS "tenko_evidence_public_read" ON storage.objects;
CREATE POLICY "tenko_evidence_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'tenko-evidence');

DROP POLICY IF EXISTS "tenko_evidence_admin_insert" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

DROP POLICY IF EXISTS "tenko_evidence_admin_update" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') = 'kmdimcc@gmail.com')
  WITH CHECK (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

DROP POLICY IF EXISTS "tenko_evidence_admin_delete" ON storage.objects;
CREATE POLICY "tenko_evidence_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenko-evidence' AND (auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');
