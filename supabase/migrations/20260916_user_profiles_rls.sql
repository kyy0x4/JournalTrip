-- RLS user_profiles: tiap user cuma bisa baca & tulis baris miliknya sendiri
-- (auth.uid() = user_id). Anon tidak bisa apa-apa.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_owner_select" ON user_profiles;
CREATE POLICY "user_profiles_owner_select"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_owner_insert" ON user_profiles;
CREATE POLICY "user_profiles_owner_insert"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_owner_update" ON user_profiles;
CREATE POLICY "user_profiles_owner_update"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_owner_delete" ON user_profiles;
CREATE POLICY "user_profiles_owner_delete"
  ON user_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Bucket storage user-avatars (jalankan sekali di Dashboard → SQL Editor):
--   insert into storage.buckets (id, name, public) values ('user-avatars', 'user-avatars', true)
--   on conflict (id) do nothing;
--
-- Policy storage: baca publik, tulis hanya folder milik sendiri (<uid>/...).
DROP POLICY IF EXISTS "user_avatars_public_read" ON storage.objects;
CREATE POLICY "user_avatars_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'user-avatars');

DROP POLICY IF EXISTS "user_avatars_owner_insert" ON storage.objects;
CREATE POLICY "user_avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user_avatars_owner_update" ON storage.objects;
CREATE POLICY "user_avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user_avatars_owner_delete" ON storage.objects;
CREATE POLICY "user_avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
