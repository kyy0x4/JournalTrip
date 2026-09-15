# AGENTS.md — JournalTrip (Trip Monitoring Dashboard)

## Project Overview

React (Vite + TypeScript + Tailwind v4) SPA untuk monitoring armada PT K-Line Mobaru
Diamond Indonesia: dashboard ritase, tenko (health check), gatepass/P2H, leadtime,
route analytics per area (SULAWESI/SUMATERA/NGORO), eco driving, training center,
report KR. Backend Supabase, deploy frontend ke Vercel.

Bahas komunikasi dengan santai (bahasa Indonesia casual, boleh campur istilah teknis
Inggris). User pegang langsung spreadsheet & Apps Script; suka langkah manual dijalankan
sendiri lalu lapor hasilnya.

## Commands

```bash
npm run dev       # vite dev server, port 3000
npm run lint      # tsc --noEmit (typecheck)
npm run build     # vite build
```

Jangan pernah push asal ke production; konfirmasi dulu. Commit message bahasa
Indonesia, ringkas, format `fix:/feat:/perf:`.

## Data Pipeline (Google Sheets → Supabase)

- **Spreadsheet Google = sumber kebenaran (source of truth)** untuk data analitik.
- Tiap spreadsheet punya **project Apps Script sendiri** yang baca sheet, kirim ke
  edge function `sheet-sync` (Supabase), yang nulis ke tabel dengan service role.
- Apps Script pakai `WRITE_KEY` yang dikirim via header `x-write-key` — **bukan**
  hardcode, diambil dari Script Properties. Jangan pernah taruh key di kode.
- Pola sync dominan: `delete_then_insert` per area/tanggal (hapus scope dulu, insert
  ulang) → edge function wajib dukung `match` dengan array (IN) & objek (range).
  Kecuali KPI Training yang pakai `upsert` `on_conflict=nik,bulan`.
- File Apps Script taruh di `supabase/functions/sheet-sync/*.gs`. Satu project Apps
  Script hanya boleh punya SATU `onOpen`; helper bersama (callSync dkk) cuma di file
  utama. Tiap area analitik (SULAWESI, dst) punya file sync sendiri.
- **Rencana migrasi (belum jalan):** pindahkan script dari bound container ke
  **standalone project di akun user** + target sheet via `openById`, biar editor
  spreadsheet nggak bisa lihat kode/secret. Sync manual lewat web app / Run, bukan
  time trigger (user mau kontrol manual).

## Database / RLS notes

- Tabel utama: `trips`, `leadtimes`, `tenko`, `driver_training_monthly`, `kr_reports`,
  `p2h`, `gatepass`, `drivers`.
- Akses client pakai anon key; RLS batasi SELECT/UPDATE. Writes sensitif lewat edge
  function `sheet-sync` (service role di server-side), bukan dari client.
- `supabase/functions/` (Deno) di-exclude dari tsconfig React biar `npm run lint` bersih.
- Tabel `tenko` kolom `id` UUID unik. Kolom `sistolik/diastolik` sumber klasifikasi
  hipertensi (>=145/90), hipotensi (<90/60) — hati-hati jangan dedup by
  driver+timestamp: satu sesi cek bisa punya 2 pengukuran valid (tensi tinggi lalu
  normal) dengan timestamp identik.

## Tenko Page — konvensi penting

- File: `src/pages/TenkoPage.tsx` + `src/services/tenkoService.ts`.
- Pagination `fetchTenkoData` pakai **keyset by id** (`.order('id').gt('id')`) +
  dedup by id unik — jangan balik ke `.range()`/dedup timestamp (bikin data ke-drop).
- `shouldUseMonthlyTrend` per-bulan **hanya kalau rentang >31 hari**; selain itu
  chart per-hari walau beda bulan.
- Threshold hipertensi sistolik = **145** (bukan 140).

## Single Carrier / Double Deck (2026-09-15, belum sync perdana)

- Tabel tetap `trips` + `leadtimes` (tanpa migrasi DB) — area baru `SINGLE CARRIER` / `DOUBLE DECK`, masuk dropdown TAM (JBK, SUMATERA, NGORO, SINGLE CARRIER, DOUBLE DECK).
- Satu sheet gabungan `MONITORING SINGLE CARRIER` tanpa kolom area → split per baris by nopol: `B 9951 KIN` = DOUBLE DECK, sisanya SINGLE CARRIER (`DOUBLE_DECK_NOPOLS` di `apps_script_send_data.gs`). Delete pakai array `[SINGLE CARRIER, DOUBLE DECK]` biar dua-duanya kehapus bareng.
- Index kolom sheet SC (0-based): tgl=1, nopol=2, driver=3, shift=5, ritase=6, outpool=9, pdc_muat=10, plan_dccp=14 (Plan DCCP), in_pdc=12, out_pdc=18, pdc_bongkar=21, plan_unload=22, actual_unload=23. Kolom lain (tenko, loading, leadtime, backtopool) masuk checkpoints/status_info otomatis via `mapToLeadtimesTable`.
- LeadTimePage: delivery baca `Status Leadtime Delivery` / `Status Leadtime` untuk SC/DD; timeline pakai flow JBK (OutPool→InPDC→OutPDC→Unloading).
- **Cara pakai:** copy `apps_script_send_data.gs` ke Apps Script Monitoring → sheet harus mengandung "MONITORING" + "SINGLE CARRIER" di namanya → Run `uploadSemuaArea` (trips) + `uploadLeadtimeAll` (leadtimes).

## Status Terakhir (2026-09-12)

- [x] Fix Tenko di-commit & push: `01845e1` — data hipertensi dobel ke-drop & chart
      beda bulan jadi per-hari (2 file: `TenkoPage.tsx`, `tenkoService.ts`).
- [x] AGENTS.md di-commit & push: `55951e5`.
- [x] Font ganti ke ABC Ginto Normal (body & heading) di-commit & push: `c665ae1`
      (file woff di `src/image/ginto/`). Catatan: versi **Trial** — lisensi evaluasi,
      belum buat produksi; Nord dihapus karena user minta "jangan bold".
- [x] Investigasi selisih leadtime JBK 30 Agt–4 Sep: sheet 46 vs web 39.
      Root cause bukan bug frontend — tapi pipeline Sheet→Supabase (driver tidak ke-map / baris invalid ke-skip).
      Web bener mirror DB: JBK 30 Agt–11 Sep = 317 rows, Delay IN-PDC = 62 (Macet 22 dll). Cek via `scratch/jbk_0409_delay.sql`.
      Next: dump per-driver buat VLOOKUP sheet vs DB (belum dikerjakan).
- [x] Leadtime JBK 4–11 Sep selisih 67 vs 62 — masih investigasi, belum ketemu 5 baris hilang.
- [ ] **BELUM di-deploy** — fix sheet-sync Gateway Timeout (504/500) trips:
      - Bug critical `supabase/functions/sheet-sync/index.ts`: `applyMatch()` tidak return `q` (supabase-js immutable) →
        `delete` jalan tanpa WHERE (hapus semua) → timeout. Fix: `q = applyMatch(q, match)` + `return q`.
        Tuning `INSERT_CHUNK 500→250`, `MAX_CONCURRENCY 4→2`.
      - `supabase/functions/sheet-sync/apps_script_send_data.gs`:
        `CALLSYNC_BATCH 2000→500`, `uploadSemuaArea` & `uploadLeadtimeAll` sekarang pakai `callSyncBatched`
        + try/catch per sheet + toast progress + `sleep 800ms` antar sheet.
      - **Harus deploy 2 file**: (1) copy `apps_script_send_data.gs` ke Apps Script "send data",
        (2) deploy `index.ts` via `supabase functions deploy sheet-sync` / Dashboard. Tanpa deploy index.ts, trips tetap 500.
      - WRITE_KEY masih hardcode fallback `2b2ead...` (sudah ke-expose) — habis ini harus rotate Secret di Dashboard.
- [ ] **BELUM di-commit** — refactor Apps Script sheet-sync (dari 2026-09-05):
      - WRITE_KEY dipindah ke Script Properties di `apps_script_kpi_training.gs`,
        `apps_script_kr_report.gs`, `apps_script_tenko.gs`.
      - Hapus `apps_script_sulawesi.gs` & `syncLeadTimeLuarKota` (example) → diganti
        file baru `apps_script_send_data.gs` & `apps_script_sync_sulawesi.gs`.
      - Rencana: standalone script di akun user (openById), script PADANG & KALIMANTAN, verifikasi + commit.
- Scratch dibersihin 2026-09-12 (sisa `scratch/jbk_0409_delay.sql` + `scratch/check_now.mjs` buat debug).
- Taste/project-domain di `.commandcode/taste/` juga ada perubahan yang belum di-commit
  (jangan di-commit ke repo — itu dikelola otomatis).

## Security Audit (2026-09-05) — belum diperbaiki

Audit statis keamanan data (RLS/DB + secret client + edge function). Belum ada
perbaikan yang diterapkan. Temuan prioritas:

### CRITICAL
- **C1 — tenko bisa diubah & disedot semua user login**: policy
  `tenko_authenticated_update_tensi_faktor` `USING(true) WITH CHECK(true)` (update
  semua kolom/baris) + RPC `update_tenko_tensi_faktor` `SECURITY DEFINER` yang bisa
  target baris arbitrary by tanggal+timestamp+nama & `RETURNING *` (bocorin tensi,
  alkohol, NIK). File: `supabase/migrations/20260610_tenko_tensi_faktor_update_policy.sql`.
  Fix: batasi RPC (wajib `auth.uid()`/ownership, hapus `RETURNING *`), policy update
  cuma kolom faktor.
- **C2 — Semua authenticated = CRUD penuh**: `leadtimes`, `driver_training_monthly`,
  `kr_reports`, `driver_coaching_sessions` semua policy `USING(true)` utk
  authenticated. Tidak ada role DB (admin/checker/viewer); admin cuma dijaga di
  frontend (`email === ADMIN_EMAIL` di `src/constants/roles.ts`).
- **C3 — Anon bisa baca `driver_training_monthly` & `leadtimes`**: policy
  `anon_read_*` `USING(true)` di `supabase/rls_policies.sql` (NIK + nilai training
  bocor tanpa login).
- **C4 — Storage bucket `coaching-photos` publik upload/update tanpa owner**:
  `scratch/setup_coaching.sql` (di luar migrations!) `public=true` + policy cuma cek
  `bucket_id`. Bucket `driver-photos`/`sim-photos` tanpa policy tercodify.

### IMPORTANT
- **RLS `drivers`, `trips`, `p2h`, `gatepass`, `eco_driving_violations` tidak ada di
  repo** — komentar `supabase/rls_policies.sql` cuma klaim "AMAN"; kemungkinan di-set
  manual di Dashboard. Perlu dicek langsung & dipindah ke file migrations.
- **Otorisasi admin murni frontend** (`isAdminUser`), operasi `drivers` UPDATE
  (`AdminDriversPage.tsx`) tanpa enforce server-side.
- **Data kesehatan plaintext di localStorage**: `jtrip_local_manual_tenko_data` &
  `jtrip_local_p2h_data` (`src/services/gatepassService.ts`) — fallback cache yang
  tak pernah dibersihkan; token sesi Supabase juga persist di localStorage.
- **Bom waktu env**: `vite.config.ts` nge-`define` `process.env.GEMINI_API_KEY` ke
  bundle. Hari ini kosong & tak terpakai, tapi kalau diisi → secret publik di `dist/`.
- **Edge function `sheet-sync`**: `replace_all` bisa wipe tabel penuh; `match:{}` =
  delete semua tanpa guard (`index.ts`); satu WRITE_KEY shared untuk semua script;
  tanpa rate limiting.

### Yang sudah aman
- `.env` ke-gitignore (cuma anon key `VITE_*`), tidak ada service_role/secret asli
  di client atau file ter-commit.
- WRITE_KEY sudah pindah ke Script Properties.
- Tidak ada SQL injection (semua via PostgREST parameterized).

Rencana perbaikan (urut prioritas): C1 → C2/C3 → C4 → RLS 5 tabel pindah ke
migrations → rate limit + perbaikan sheet-sync → bersihkan localStorage.
