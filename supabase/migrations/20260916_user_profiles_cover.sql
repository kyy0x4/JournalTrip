-- Sampul profil ala Facebook (bisa diganti foto upload, default pemandangan di frontend)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cover_url text;
