-- Evaluasi cancel order per ritase (diisi manual akun admin via Fleet Monitoring)
-- Tabel terpisah dari trips: trips di-sync pola delete_then_insert dari sheet,
-- jadi kolom manual di trips bakal kehapus tiap sync. Satu baris = satu ritase.
CREATE TABLE IF NOT EXISTS trip_cancel_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL UNIQUE,
  tanggal date NOT NULL,
  nopol text,
  ritase_no text,
  faktor text NOT NULL CHECK (faktor IN ('Customer batal', 'Unit trouble', 'Driver berhalangan', 'Kendala lapangan')),
  keterangan text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_cancel_evaluations_tanggal ON trip_cancel_evaluations(tanggal);
CREATE INDEX IF NOT EXISTS idx_trip_cancel_evaluations_nopol ON trip_cancel_evaluations(nopol);
