-- KR Loading Units: monitoring muatan unit mobil ke car carrier oleh KR
-- Sumber: spreadsheet KR (terpisah dari kr_reports). Satu baris = satu event loading.
CREATE TABLE IF NOT EXISTS kr_loading_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_timestamp timestamptz,
  nama_kr text NOT NULL,
  pdc_muat text,
  tanggal_muat text NOT NULL,
  tanggal_muat_date date,
  jam_muat text,
  no_lambung text,
  nama_driver text,
  total_muat smallint,
  no_rangka_1 text,
  no_rangka_2 text,
  no_rangka_3 text,
  no_rangka_4 text,
  no_rangka_5 text,
  no_rangka_6 text,
  tujuan_pengiriman text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kr_loading_units_tanggal ON kr_loading_units(tanggal_muat_date);
CREATE INDEX IF NOT EXISTS idx_kr_loading_units_nama_kr ON kr_loading_units(nama_kr);
CREATE INDEX IF NOT EXISTS idx_kr_loading_units_lambung ON kr_loading_units(no_lambung);
CREATE INDEX IF NOT EXISTS idx_kr_loading_units_pdc ON kr_loading_units(pdc_muat);
CREATE INDEX IF NOT EXISTS idx_kr_loading_units_tujuan ON kr_loading_units(tujuan_pengiriman);

-- Tidak pakai unique index: satu lambung bisa muat berkali-kali sehari (valid).
-- Dedup via delete_then_insert per rentang tanggal_muat_date di Apps Script.
