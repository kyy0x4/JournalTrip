// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — SYNC REPORT KR (khusus kr_reports)
//
// CARA PAKAI:
//   1. Copy SELURUH isi file ini ke project Apps Script sheet KR Report (replace semua)
//   2. Isi WRITE_KEY sesuai yang di-set di Supabase secrets
//   3. Save → tutup & buka ulang spreadsheet → menu "KR Report" muncul
//
// CATATAN:
//   - Pola sync: delete per rentang tanggal (tanggal_date), lalu insert ulang.
//   - Sebelumnya pakai service_role key → versi ini lewat edge function.
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY = '<ISI_DENGAN_WRITE_KEY>';
const CALLSYNC_BATCH = 2000; // pecah batch > 2000 baris biar sync cepet

// Daftar sheet yang mau di-sync. Urutan bebas; masing-masing di-proses
// sendiri-sendiri (delete-then-insert per rentang tanggal sheet tsb).
const SHEET_NAMES = ['Loading& Unloading 2025', 'Loading& Unloading 2026'];

// ── Kirim operasi ke edge function ─────────────────────────────────────────────
function callSync(table, operation, rows, match) {
  const payload = { table, operation };
  if (rows) payload.rows = rows;
  if (match) payload.match = match;

  const res = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'x-write-key': WRITE_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 290,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 400) {
    throw new Error('Sync gagal (' + code + '): ' + body);
  }
  return JSON.parse(body);
}

// Versi callSync yang otomatis pecah batch besar. Untuk delete_then_insert,
// delete-nya cukup di request pertama, sisanya insert doang.
function callSyncBatched(table, operation, rows, match) {
  if (!rows || rows.length <= CALLSYNC_BATCH) {
    return callSync(table, operation, rows, match);
  }

  let total = 0;
  const first = callSync(table, operation, rows.slice(0, CALLSYNC_BATCH), match);
  total += first.count || 0;

  for (let i = CALLSYNC_BATCH; i < rows.length; i += CALLSYNC_BATCH) {
    const chunk = rows.slice(i, i + CALLSYNC_BATCH);
    const r = callSync(table, 'insert', chunk);
    total += r.count || 0;
  }
  return { ok: true, count: total };
}

// ── Menu ────────────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('KR Report')
    .addItem('Sync ke Supabase', 'uploadKRReports')
    .addSeparator()
    .addItem('Cek Status Data', 'checkKRData')
    .addToUi();
}

// ── Helper format ───────────────────────────────────────────────────────────────
function formatCell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  }
  return String(v).trim();
}

/** Parse tanggal (string "DD/MM/YYYY ...", ISO, atau Date) -> ISO yyyy-mm-dd, atau null */
function parseTanggal(t) {
  if (!t) return null;
  if (t instanceof Date && !isNaN(t.getTime())) {
    return Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(t).trim();
  // ISO "2026-01-15..."
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  // "DD/MM/YYYY" atau "DD-MM-YYYY"
  const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!dmy) return null;
  let yyyy = dmy[3];
  if (yyyy.length === 2) yyyy = '20' + yyyy;
  return `${yyyy}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
}

// ── Upload satu sheet ───────────────────────────────────────────────────────────
function uploadSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { ok: false, message: `Sheet "${sheetName}" tidak ditemukan.` };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  // Kolom sheet (harus urut sesuai Google Sheet Report KR)
  const HEADER_MAP = [
    { sheet: 'Tanggal',                db: 'tanggal' },
    { sheet: 'Nama KR',                db: 'nama_kr' },
    { sheet: 'Area Loading',           db: 'area_loading' },
    { sheet: 'No Lambung',             db: 'no_lambung' },
    { sheet: 'Nama Driver',            db: 'nama_driver' },
    { sheet: 'Nama Asisten',           db: 'nama_asisten' },
    { sheet: 'Waktu In PDC',           db: 'waktu_in_pdc' },
    { sheet: 'Waktu Loading',          db: 'waktu_loading' },
    { sheet: 'Waktu Unloading',        db: 'waktu_unloading' },
    { sheet: 'APD Driver',             db: 'apd_driver' },
    { sheet: 'APD Asissten',           db: 'apd_asisten' },
    { sheet: 'Temuan NG APD',          db: 'temuan_ng_apd' },
    { sheet: 'Dokumentasi APD NG (Bila ADA)', db: 'dokumentasi_apd_ng' },
  ];

  // Loading position 1..7 (driver, asisten, temuan NG)
  for (let p = 1; p <= 7; p++) {
    HEADER_MAP.push(
      { sheet: `Loading Position ${p} [Driver]`,    db: `loading_position_${p}_driver` },
      { sheet: `Loading Position ${p} [Assistant]`, db: `loading_position_${p}_asisten` },
      { sheet: `Temuan NG di Loading Position ${p} :`, db: `temuan_ng_loading_position_${p}` }
    );
  }

  HEADER_MAP.push(
    { sheet: 'Dokumentasi Unit NG (Bila ADA)', db: 'dokumentasi_unit_ng' },
    { sheet: 'Ada kejadian Incident ?',         db: 'ada_kejadian_incident' },
    { sheet: 'Kronologis Incident (BNF) :',     db: 'kronologis_incident' }
  );

  // Map index kolom sheet -> nama kolom db
  const colIdx = {};
  headers.forEach((h, i) => {
    const found = HEADER_MAP.find(x => x.sheet === String(h).trim());
    if (found) colIdx[i] = found.db;
  });
  const dbCols = Object.values(colIdx);
  if (dbCols.length === 0) {
    return { ok: false, message: 'Header sheet tidak cocok dengan template Report KR.' };
  }

  // Build rows (skip baris kosong)
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const record = {};
    let hasData = false;
    Object.keys(colIdx).forEach(i => {
      const v = formatCell(row[i]);
      if (v !== '') hasData = true;
      record[colIdx[i]] = v;
    });
    if (!hasData) continue;

    // Parse tanggal -> tanggal (text) + tanggal_date (ISO yyyy-mm-dd)
    record['tanggal_date'] = parseTanggal(record['tanggal']);
    rows.push(record);
  }

  if (rows.length === 0) {
    return { ok: true, message: 'Tidak ada baris data untuk diupload.', success: 0, failed: 0 };
  }

  // ── 1) DELETE data di rentang tanggal yang ada di sheet ──
  const dates = rows.map(r => r.tanggal_date).filter(d => d);
  try {
    if (dates.length > 0) {
      const minDate = dates.reduce((a, b) => a < b ? a : b);
      const maxDate = dates.reduce((a, b) => a > b ? a : b);
      Logger.log(`DELETE ${sheetName} ${minDate}..${maxDate} (lewat edge function)`);
      // delete_then_insert: request pertama delete range + insert batch 1,
      // sisanya insert doang (callSyncBatched handle otomatis)
      const result = callSyncBatched('kr_reports', 'delete_then_insert', rows, {
        tanggal_date: { gte: minDate, lte: maxDate }
      });
      Logger.log(`Selesai ${sheetName}. Berhasil ${result.count}.`);
      return { ok: true, message: `Berhasil ${result.count}.`, success: result.count, failed: 0 };
    }
  } catch (e) {
    Logger.log(`Error ${sheetName}: ${e.message}`);
    return { ok: false, message: 'Error: ' + e.message, success: 0, failed: rows.length };
  }
}

// ── Inti upload: loop semua sheet di SHEET_NAMES ────────────────────────────────
function runUploadKR() {
  const results = [];
  for (const name of SHEET_NAMES) {
    const res = uploadSheet(name);
    results.push({ sheet: name, ...res });
    Logger.log(`${name} -> ${res.message}`);
  }

  const totalSuccess = results.reduce((a, r) => a + (r.success || 0), 0);
  const totalFailed = results.reduce((a, r) => a + (r.failed || 0), 0);
  const failedSheets = results.filter(r => !r.ok).map(r => r.sheet);

  const message = failedSheets.length === 0
    ? `Semua sheet sukses. Total berhasil ${totalSuccess}, gagal ${totalFailed}.`
    : `Ada masalah di: ${failedSheets.join(', ')}. Total berhasil ${totalSuccess}, gagal ${totalFailed}.`;

  return { ok: failedSheets.length === 0, success: totalSuccess, failed: totalFailed, message: message, results: results };
}

// ── Pemicu manual dari menu spreadsheet ─────────────────────────────────────────
function uploadKRReports() {
  const ui = SpreadsheetApp.getUi();
  const res = runUploadKR();
  Logger.log(res.message);
  ui.alert('Sync ke Supabase', res.message, ui.ButtonSet.OK);
  return res;
}

// ── Cek jumlah data yang sudah tersimpan di Supabase ────────────────────────────
function checkKRData() {
  const ui = SpreadsheetApp.getUi();
  try {
    // Pakai edge function untuk hitung (anon key nggak bisa hitung via HEAD di
    // beberapa setup; fallback: panggil select count via edge function insert? tidak.
    // Paling simpel: cek via REST pakai anon key (SELECT boleh).
    const SUPABASE_URL = 'https://tdtywoejybnunxyqzmst.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_Tw6kojTfpCtKpk7hmAGSPQ_0MqvWpiF';
    const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/kr_reports?select=id`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'count=exact',
      },
      muteHttpExceptions: true,
    });
    let count = 0;
    if (response.getResponseCode() < 300) {
      const range = response.getHeaders()['Content-Range'];
      if (range) {
        const m = String(range).match(/\/(\d+)/);
        if (m) count = Number(m[1]);
      }
    }
    ui.alert('Status Data', `Total laporan tersimpan di Supabase: ${count}`, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Status Data', 'Gagal cek status: ' + e.message, ui.ButtonSet.OK);
  }
}

// ── Web App endpoint — dipakai bila ingin dipicu dari luar spreadsheet ──────────
function doGet(e) {
  return jsonOutput(runUploadKR());
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
