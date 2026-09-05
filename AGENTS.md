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

## Status Terakhir (2026-09-05)

- [x] Fix Tenko di-commit & push: `01845e1` — data hipertensi dobel ke-drop & chart
      beda bulan jadi per-hari (2 file: `TenkoPage.tsx`, `tenkoService.ts`).
- [ ] **BELUM di-commit** — refactor Apps Script sheet-sync:
      - WRITE_KEY dipindah ke Script Properties di `apps_script_kpi_training.gs`,
        `apps_script_kr_report.gs`, `apps_script_tenko.gs`.
      - Hapus `apps_script_sulawesi.gs` & `syncLeadTimeLuarKota` (example) → diganti
        file baru `apps_script_send_data.gs` (file utama: onOpen + callSync +
        sync trips/leadtime) & `apps_script_sync_sulawesi.gs` (sync SULAWESI doang).
      - Berikutnya (rencana): standalone script di akun user (openById), script
        PADANG & KALIMANTAN per-area, verifikasi + commit refactor.
- Taste/project-domain di `.commandcode/taste/` juga ada perubahan yang belum di-commit
  (jangan di-commit ke repo — itu dikelola otomatis).
