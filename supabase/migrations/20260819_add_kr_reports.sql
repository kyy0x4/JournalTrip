-- Report KR (Kepala Rombongan): data dikirim dari Google Sheet via Apps Script
CREATE TABLE IF NOT EXISTS kr_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal text NOT NULL,
  tanggal_date date,
  nama_kr text NOT NULL,
  area_loading text,
  no_lambung text,
  nama_driver text,
  nama_asisten text,
  waktu_in_pdc text,
  waktu_loading text,
  waktu_unloading text,
  apd_driver text,
  apd_asisten text,
  temuan_ng_apd text,
  dokumentasi_apd_ng text,
  loading_position_1_driver text,
  loading_position_1_asisten text,
  temuan_ng_loading_position_1 text,
  loading_position_2_driver text,
  loading_position_2_asisten text,
  temuan_ng_loading_position_2 text,
  loading_position_3_driver text,
  loading_position_3_asisten text,
  temuan_ng_loading_position_3 text,
  loading_position_4_driver text,
  loading_position_4_asisten text,
  temuan_ng_loading_position_4 text,
  loading_position_5_driver text,
  loading_position_5_asisten text,
  temuan_ng_loading_position_5 text,
  loading_position_6_driver text,
  loading_position_6_asisten text,
  temuan_ng_loading_position_6 text,
  loading_position_7_driver text,
  loading_position_7_asisten text,
  temuan_ng_loading_position_7 text,
  dokumentasi_unit_ng text,
  ada_kejadian_incident text,
  kronologis_incident text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kr_reports_tanggal ON kr_reports(tanggal_date);
CREATE INDEX IF NOT EXISTS idx_kr_reports_nama_kr ON kr_reports(nama_kr);
CREATE INDEX IF NOT EXISTS idx_kr_reports_area ON kr_reports(area_loading);

-- NOTE: TIDAK pakai unique index untuk dedup. Driver/KR yang sama bisa muncul
-- berkali-kali dalam sehari (itu data valid). Dedup dilakukan via strategi
-- "hapus per rentang tanggal lalu insert ulang" di Apps Script (delete-then-insert).
DROP INDEX IF EXISTS idx_kr_reports_unique;
