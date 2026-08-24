-- ─────────────────────────────────────────────────────────────
-- Fix tabel p2h: bersihkan duplikat + tambah unique constraint
-- Jalankan di Supabase Dashboard → SQL Editor
-- Latar belakang: upsert onConflict (driver_id,tanggal) gagal dengan
-- error 42P10 karena constraint-nya belum ada, sehingga menumpuk
-- duplikat saat checker edit P2H.
-- ─────────────────────────────────────────────────────────────

-- 1. Hapus duplikat, sisakan 1 baris terbaru per (driver_id, tanggal)
DELETE FROM p2h a
USING p2h b
WHERE a.driver_id = b.driver_id
  AND a.tanggal = b.tanggal
  AND a.created_at < b.created_at;

-- 2. Tambahkan unique constraint agar upsert & data ke depannya konsisten
ALTER TABLE p2h
  ADD CONSTRAINT p2h_driver_tanggal_unique UNIQUE (driver_id, tanggal);
