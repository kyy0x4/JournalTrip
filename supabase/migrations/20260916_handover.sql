-- Beranda serah terima shift (MCC ↔ Tenko) ala Facebook.
-- Postingan: teks + 1 foto + status open/done. Komentar: teks.
CREATE TABLE IF NOT EXISTS handover_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  author_email text,
  author_name text,
  content text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover_posts_created ON handover_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handover_posts_status ON handover_posts(status);

CREATE TABLE IF NOT EXISTS handover_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES handover_posts(id) ON DELETE CASCADE,
  author_id uuid,
  author_email text,
  author_name text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover_comments_post ON handover_comments(post_id, created_at);
