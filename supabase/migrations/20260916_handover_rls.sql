-- RLS handover (Beranda serah terima).
-- Baca: semua user login. Tulis post: owner + mcc (kmdimcc) + tenko.
-- Komentar: semua user login boleh (biar ops bisa nimbrung).
-- Hapus post: penulis sendiri atau owner. Status done: penulis atau owner/admin/tenko.
ALTER TABLE handover_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON handover_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON handover_comments TO authenticated;

DROP POLICY IF EXISTS "handover_posts_auth_select" ON handover_posts;
CREATE POLICY "handover_posts_auth_select"
  ON handover_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "handover_posts_shift_insert" ON handover_posts;
CREATE POLICY "handover_posts_shift_insert"
  ON handover_posts FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com'));

DROP POLICY IF EXISTS "handover_posts_author_update" ON handover_posts;
CREATE POLICY "handover_posts_author_update"
  ON handover_posts FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id
    OR (auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com')
  )
  WITH CHECK (
    auth.uid() = author_id
    OR (auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com')
  );

DROP POLICY IF EXISTS "handover_posts_author_delete" ON handover_posts;
CREATE POLICY "handover_posts_author_delete"
  ON handover_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR (auth.jwt() ->> 'email') = 'kyyaspi13@gmail.com');

DROP POLICY IF EXISTS "handover_comments_auth_select" ON handover_comments;
CREATE POLICY "handover_comments_auth_select"
  ON handover_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "handover_comments_auth_insert" ON handover_comments;
CREATE POLICY "handover_comments_auth_insert"
  ON handover_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "handover_comments_author_update" ON handover_comments;
CREATE POLICY "handover_comments_author_update"
  ON handover_comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR (auth.jwt() ->> 'email') = 'kyyaspi13@gmail.com')
  WITH CHECK (auth.uid() = author_id OR (auth.jwt() ->> 'email') = 'kyyaspi13@gmail.com');

DROP POLICY IF EXISTS "handover_comments_author_delete" ON handover_comments;
CREATE POLICY "handover_comments_author_delete"
  ON handover_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR (auth.jwt() ->> 'email') = 'kyyaspi13@gmail.com');

-- Bucket storage handover-photos (jalankan sekali di Dashboard → SQL Editor):
--   insert into storage.buckets (id, name, public) values ('handover-photos', 'handover-photos', true)
--   on conflict (id) do nothing;
--
-- Policy storage: baca publik (login), upload khusus shift (owner/mcc/tenko).
DROP POLICY IF EXISTS "handover_photos_auth_read" ON storage.objects;
CREATE POLICY "handover_photos_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'handover-photos');

DROP POLICY IF EXISTS "handover_photos_shift_insert" ON storage.objects;
CREATE POLICY "handover_photos_shift_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'handover-photos' AND (auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com'));

DROP POLICY IF EXISTS "handover_photos_shift_update" ON storage.objects;
CREATE POLICY "handover_photos_shift_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'handover-photos' AND (auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com'))
  WITH CHECK (bucket_id = 'handover-photos' AND (auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com'));

DROP POLICY IF EXISTS "handover_photos_shift_delete" ON storage.objects;
CREATE POLICY "handover_photos_shift_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'handover-photos' AND (auth.jwt() ->> 'email') IN ('kyyaspi13@gmail.com', 'kmdimcc@gmail.com', 'tenkokmdi@gmail.com'));
