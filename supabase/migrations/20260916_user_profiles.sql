-- Profil user web (login Supabase Auth) — 1 baris per user_id (auth.users.id).
-- Terpisah dari tabel drivers (data driver armada dari sheet).
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  nickname text,
  phone text,
  jabatan text,
  departemen text,
  area text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
