// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — SYNC KR LOADING UNITS (kr_loading_units)
//
// CARA PAKAI:
//   1. Copy SELURUH isi file ini ke project Apps Script sheet KR Loading (replace semua)
//   2. Set WRITE_KEY di Script Properties (Project Settings → Script Properties)
//   3. Save → tutup & buka ulang spreadsheet → menu "KR Loading" muncul
//
// CATATAN:
//   - Pola sync: delete per rentang tanggal_muat_date, lalu insert ulang.
//   - Kolom sheet harus sesuai HEADER_MAP di bawah (ejaan harus pas).
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY = PropertiesService.getScriptProperties().getProperty('WRITE_KEY') || '';
const CALLSYNC_BATCH = 2000;

const SHEET_NAMES = ['KR Loading 2025', 'KR Loading 2026'];

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
    .createMenu('KR Loading')
    .addItem('Sync ke Supabase', 'uploadKRLoadingUnits')
    .addSeparator()
    .addItem('Cek Status Data', 'checkKRLoadingData')
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

function parseTanggal(t) {
  if (!t) return null;
  if (t instanceof Date && !isNaN(t.getTime())) {
    return Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(t).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!dmy) return null;
  let yyyy = dmy[3];
  if (yyyy.length === 2) yyyy = '20' + yyyy;
  return `${yyyy}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
}

function parseTimestamp(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  // Coba parse "DD/MM/YYYY HH:mm:ss" atau ISO
  const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dmy) {
    let yyyy = dmy[3];
    if (yyyy.length === 2) yyyy = '20' + yyyy;
    const iso = `${yyyy}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}T${String(dmy[4]).padStart(2, '0')}:${String(dmy[5]).padStart(2, '0')}:${String(dmy[6] || '00').padStart(2, '0')}+07:00`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2.toISOString();
  return null;
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

  const HEADER_MAP = [
    { sheet: 'Timestamp',            db: 'entry_timestamp' },
    { sheet: 'Nama KR',              db: 'nama_kr' },
    { sheet: 'PDC Muat',             db: 'pdc_muat' },
    { sheet: 'Tanggal Muat',         db: 'tanggal_muat' },
    { sheet: 'Jam Muat',             db: 'jam_muat' },
    { sheet: 'No Lambung Armada',    db: 'no_lambung' },
    { sheet: 'Driver',               db: 'nama_driver' },
    { sheet: 'Total Muat',           db: 'total_muat' },
    { sheet: 'No Rangka 1',          db: 'no_rangka_1' },
    { sheet: 'No Rangka 2',          db: 'no_rangka_2' },
    { sheet: 'No Rangka 3',          db: 'no_rangka_3' },
    { sheet: 'No Rangka 4',          db: 'no_rangka_4' },
    { sheet: 'No Rangka 5',          db: 'no_rangka_5' },
    { sheet: 'No Rangka 6',          db: 'no_rangka_6' },
    { sheet: 'Tujuan Pengiriman',    db: 'tujuan_pengiriman' },
  ];

  const colIdx = {};
  headers.forEach((h, i) => {
    const found = HEADER_MAP.find(x => x.sheet === String(h).trim());
    if (found) colIdx[i] = found.db;
  });
  const dbCols = Object.values(colIdx);
  if (dbCols.length === 0) {
    return { ok: false, message: 'Header sheet tidak cocok dengan template KR Loading. Cek ejaan header.' };
  }

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const record = {};
    let hasData = false;
    Object.keys(colIdx).forEach(i => {
      const dbCol = colIdx[i];
      let v = row[i];
      // Timestamp kolom: parse khusus
      if (dbCol === 'entry_timestamp') {
        const parsed = parseTimestamp(v);
        record[dbCol] = parsed;
        if (parsed) hasData = true;
        return;
      }
      // Total muat: numeric
      if (dbCol === 'total_muat') {
        const raw = String(v || '').trim();
        if (raw !== '') {
          hasData = true;
          const n = Number(raw.replace(',', '.'));
          record[dbCol] = isNaN(n) ? null : Math.round(n);
        } else {
          record[dbCol] = null;
        }
        return;
      }
      const str = formatCell(v);
      if (str !== '') hasData = true;
      record[dbCol] = str;
    });
    if (!hasData) continue;

    record['tanggal_muat_date'] = parseTanggal(record['tanggal_muat']);
    rows.push(record);
  }

  if (rows.length === 0) {
    return { ok: true, message: 'Tidak ada baris data untuk diupload.', success: 0, failed: 0 };
  }

  const dates = rows.map(r => r.tanggal_muat_date).filter(d => d);
  try {
    if (dates.length > 0) {
      const minDate = dates.reduce((a, b) => a < b ? a : b);
      const maxDate = dates.reduce((a, b) => a > b ? a : b);
      Logger.log(`DELETE ${sheetName} ${minDate}..${maxDate} (lewat edge function)`);
      const result = callSyncBatched('kr_loading_units', 'delete_then_insert', rows, {
        tanggal_muat_date: { gte: minDate, lte: maxDate }
      });
      Logger.log(`Selesai ${sheetName}. Berhasil ${result.count}.`);
      return { ok: true, message: `Berhasil ${result.count}.`, success: result.count, failed: 0 };
    } else {
      // Tidak ada tanggal valid — insert tanpa delete range
      const result = callSyncBatched('kr_loading_units', 'insert', rows);
      Logger.log(`Selesai ${sheetName} (tanpa tanggal valid). Berhasil ${result.count}.`);
      return { ok: true, message: `Berhasil ${result.count} (tanpa filter tanggal).`, success: result.count, failed: 0 };
    }
  } catch (e) {
    Logger.log(`Error ${sheetName}: ${e.message}`);
    return { ok: false, message: 'Error: ' + e.message, success: 0, failed: rows.length };
  }
}

// ── Inti upload: loop semua sheet di SHEET_NAMES ────────────────────────────────
function runUploadKRLoading() {
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
function uploadKRLoadingUnits() {
  const ui = SpreadsheetApp.getUi();
  const res = runUploadKRLoading();
  Logger.log(res.message);
  ui.alert('Sync ke Supabase', res.message, ui.ButtonSet.OK);
  return res;
}

// ── Cek jumlah data yang sudah tersimpan di Supabase ────────────────────────────
function checkKRLoadingData() {
  const ui = SpreadsheetApp.getUi();
  try {
    const SUPABASE_URL = 'https://tdtywoejybnunxyqzmst.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_Tw6kojTfpCtKpk7hmAGSPQ_0MqvWpiF';
    const response = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/kr_loading_units?select=id`, {
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
    ui.alert('Status Data', `Total loading tersimpan di Supabase: ${count}`, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Status Data', 'Gagal cek status: ' + e.message, ui.ButtonSet.OK);
  }
}

// ── Web App endpoint — dipakai bila ingin dipicu dari luar spreadsheet ──────────
function doGet(e) {
  return jsonOutput(runUploadKRLoading());
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
