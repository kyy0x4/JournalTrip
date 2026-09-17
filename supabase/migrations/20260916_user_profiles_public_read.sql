-- Avatar + nama publik: Beranda/Navbar butuh tampilkan foto & nama penulis lain.
-- Sebelumnya SELECT cuma owner (auth.uid() = user_id) → avatar orang lain selalu kosong.
-- Policy baru: semua user login boleh baca kolom publik user_profiles.
-- (Data sensitif tidak ada di tabel ini: cuma nama, jabatan, area, bio, foto.)
DROP POLICY IF EXISTS "user_profiles_auth_select_public" ON user_profiles;
CREATE POLICY "user_profiles_auth_select_public"
  ON user_profiles FOR SELECT TO authenticated
  USING (true);
