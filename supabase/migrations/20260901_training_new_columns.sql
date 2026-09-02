-- Migration: kolom baru untuk format training September 2026+
-- Sheet sekarang punya per-minggu: HASIL_PRE_TEST, HASIL_POST_TEST, KETERANGAN_TEST
-- plus TOTAL_NILAI dan Q3_KEHADIRAN per bulan.

ALTER TABLE driver_training_monthly
  ADD COLUMN IF NOT EXISTS hasil_pre_test text,
  ADD COLUMN IF NOT EXISTS hasil_post_test text,
  ADD COLUMN IF NOT EXISTS keterangan_test text,
  ADD COLUMN IF NOT EXISTS total_nilai numeric,
  ADD COLUMN IF NOT EXISTS q_kehadiran integer;
