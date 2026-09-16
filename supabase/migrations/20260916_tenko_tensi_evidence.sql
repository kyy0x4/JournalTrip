-- Evidence foto hipertensi: 3 slot fix per baris tenko
-- (1 tensi tinggi, 2 sedang istirahat, 3 tensi ulang turun).
-- Tabel terpisah dari tenko: tenko di-sync delete_then_insert dari sheet,
-- jadi URL manual di tenko bakal kehapus tiap sync. Satu baris = satu tenko_id.
CREATE TABLE IF NOT EXISTS tenko_tensi_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenko_id text NOT NULL UNIQUE,
  tanggal date,
  nama_driver text,
  foto_tensi_tinggi text,
  foto_istirahat text,
  foto_tensi_ulang text,
  uploaded_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenko_tensi_evidence_tanggal ON tenko_tensi_evidence(tanggal);
CREATE INDEX IF NOT EXISTS idx_tenko_tensi_evidence_driver ON tenko_tensi_evidence(nama_driver);
