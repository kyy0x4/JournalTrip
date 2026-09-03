-- Index untuk eco_driving_violations — kolom yang sering dipakai filter di halaman Eco.
-- Tanpa index, Postgres scan semua baris (~27K+) tiap filter Tanggal/Area/Customer.
CREATE INDEX IF NOT EXISTS idx_eco_tanggal ON eco_driving_violations ("Tanggal");
CREATE INDEX IF NOT EXISTS idx_eco_area ON eco_driving_violations ("Area");
CREATE INDEX IF NOT EXISTS idx_eco_customer ON eco_driving_violations ("Customer");
CREATE INDEX IF NOT EXISTS idx_eco_pengemudi ON eco_driving_violations ("Pengemudi");
