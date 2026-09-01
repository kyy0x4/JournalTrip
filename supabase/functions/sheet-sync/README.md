# sheet-sync — Edge Function untuk sync Google Sheets → Supabase

Menggantikan pemakaian `service_role` key di dalam Apps Script.

## Kenapa

`service_role` key punya akses penuh (bypass RLS) ke semua tabel. Kalau
kode Apps Script yang menyimpannya bocor/terlihat orang, database bisa
diubah siapa saja. Edge function ini memindahkan `service_role` ke
server-side (Supabase) dan Apps Script cukup memakai secret `WRITE_KEY`.

## Deploy

1. Instal Supabase CLI (kalau belum):
   ```bash
   npm i -g supabase
   supabase login
   ```

2. Dari folder project (yang ada `supabase/`):
   ```bash
   supabase link --project-ref <PROJECT_REF>
   # PROJECT_REF = bagian pertama dari URL Supabase kamu, misal "tdtywoejybnunxyqzmst"
   ```

3. Set secret `WRITE_KEY` (string acak panjang — jangan pernah commit ini):
   ```bash
   # generate: openssl rand -hex 32
   supabase secrets set WRITE_KEY=<hasil-openssl-rand-hex-32>
   ```

4. Deploy function:
   ```bash
   supabase functions deploy sheet-sync
   ```

5. Test:
   ```bash
   curl -X POST "https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync" \
     -H "Content-Type: application/json" \
     -H "x-write-key: <WRITE_KEY>" \
     -d '{"table":"kr_reports","operation":"insert","rows":[{"tanggal":"1999-01-01","nama_kr":"TEST"}]}'
   ```
   (Kalau sukses, langsung hapus baris test-nya.)

## Allowlist tabel

File `index.ts` membatasi tabel yang boleh ditulis lewat function ini:
`kr_reports`, `leadtimes`, `tenko`, `driver_training_monthly`, `p2h`, `trips`.
Tambah/kurangi sesuai kebutuhan di konstanta `ALLOWED_TABLES`.

## Contoh Apps Script (Google Apps Script)

Ganti `<FUNCTION_URL>`, `<WRITE_KEY>`, dan sesuaikan payload.

```js
const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY   = '<WRITE_KEY>';  // sama dengan yang di-set di Supabase secrets

function syncKRReports() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KR');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = values[i][j]; });
    rows.push(row);
  }

  const payload = {
    table: 'kr_reports',
    operation: 'delete_then_insert',
    match: { tanggal_date: '2026-08-01' },   // rentang yang di-resync
    rows: rows,
  };

  const res = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'x-write-key': WRITE_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  Logger.log('Status: ' + res.getResponseCode() + ' | ' + res.getContentText());
}
```

## Operasi yang didukung

| operation          | body                                                                |
|--------------------|---------------------------------------------------------------------|
| `insert`           | `{ table, rows: [...] }`                                            |
| `upsert`           | `{ table, rows: [...], onConflict?: "kolom" }`                      |
| `delete`           | `{ table, match: { kolom: nilai } }`                                |
| `delete_then_insert` | `{ table, match: { kolom: nilai }, rows: [...] }` (pola kr_reports) |
| `replace_all`      | `{ table, rows: [...] }` — hapus SEMUA baris di tabel, lalu insert ulang (pola "send data" Apps Script) |

## Contoh Apps Script — pola "hapus semua lalu insert ulang" (replace_all)

Kalau script kamu selama ini hapus semua data di tabel dulu baru insert
data terbaru dari spreadsheet, pakai `replace_all`:

```js
const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY   = '<WRITE_KEY>';

function sendDataLeadTimes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LeadTimes');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = values[i][j]; });
    rows.push(row);
  }

  const payload = {
    table: 'leadtimes',
    operation: 'replace_all',   // hapus semua baris leadtimes, lalu insert rows
    rows: rows,
  };

  const res = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'x-write-key': WRITE_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  Logger.log('Status: ' + res.getResponseCode() + ' | ' + res.getContentText());
}
```

> ⚠️ `replace_all` itu berbahaya kalau salah tabel. Pastikan `table` di
> payload sesuai. Kalau mau lebih aman, bisa juga pakai `delete_then_insert`
> dengan `match` (misal per tanggal) biar cuma baris di rentang itu yang
> diganti, bukan seluruh tabel.

## Keamanan

- `WRITE_KEY` disimpan sebagai secret env Supabase, tidak ada di kode mana pun.
- Bisa di-rotate kapan saja: `supabase secrets set WRITE_KEY=<baru>` — tanpa
  ubah database atau kode function.
- Tetap disarankan **rotate service_role key lama** di Supabase Dashboard →
  Settings → API Keys setelah semua script migrasi ke function ini.
- `service_role` di function ini hanya diakses server-side oleh Supabase,
  tidak pernah terekspos ke client.
