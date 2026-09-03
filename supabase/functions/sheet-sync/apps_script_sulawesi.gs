// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — SYNC SULAWESI (khusus Looker Sulawesi → leadtimes area SULAWESI)
//
// CARA PAKAI:
//   1. Copy SELURUH isi file ini ke project Apps Script spreadsheet Monitoring (replace)
//   2. Isi WRITE_KEY sesuai yang di-set di Supabase secrets
//   3. Save → buka spreadsheet → menu "🚀 SYNC DASHBOARD" → "Sinkron LeadTime Sulawesi"
//
// CATATAN:
//   - Data disimpan di kolom `checkpoints` (bukan status_info) dengan format:
//       "Actual OutPool", "Actual (Lokasi)", "Actual Unloading",
//       "Actual (Lokasi PULANG)", "Actual BackToPool", "TUJUAN", "STATUS"
//   - Lokasi pulang dikasih akhiran " PULANG" biar nggak tabrakan sama lokasi berangkat.
//   - PADANG & KALIMANTAN belum disertakan — sheet-nya belum dibereskan.
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY = '<ISI_DENGAN_WRITE_KEY>';
const CALLSYNC_BATCH = 2000;

const SULAWESI_SHEET = 'Looker Sulawesi';
const AREA = 'SULAWESI';

// Lokasi berangkat & pulang (urutan rute)
const GO_LOCATIONS = ['Pinrang', 'Majene', 'Mamuju', 'Karrosa', 'Sarjo', 'Kebon Kopi', 'Kasimbar', 'Santigi', 'Paguat'];
const RETURN_LOCATIONS = ['Paguat', 'Santigi', 'Kasimbar', 'Kebon Kopi', 'Sarjo', 'Karrosa', 'Mamuju', 'Majene', 'Pinrang'];

// ── Menu ────────────────────────────────────────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 SYNC DASHBOARD')
    .addItem('⏱️ Sinkron LeadTime Sulawesi', 'syncLeadTimeSulawesi')
    .addToUi();
}

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

// ── Helpers format ──────────────────────────────────────────────────────────────
function formatDateRaw(v) {
  if (!v) return null;
  if (v instanceof Date) {
    const d = Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    return d;
  }
  const s = String(v).trim();
  if (!s || s === '-' || s === '0') return null;
  return s;
}

function cleanHeader(h) {
  // "Plan (Kasimbar" (typo, kurang ')') → "Plan (Kasimbar)"
  // "Actual (Kasimbar )" → "Actual (Kasimbar)"
  return String(h || '').trim().replace(/\(\s*/g, '(').replace(/\s*\)/g, ')');
}

// Cari index kolom; normalisasi header dulu
function findCol(headers, name) {
  const target = cleanHeader(name);
  for (let i = 0; i < headers.length; i++) {
    if (cleanHeader(headers[i]) === target) return i;
  }
  return -1;
}

// ── Sync utama ──────────────────────────────────────────────────────────────────
function syncLeadTimeSulawesi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const sheet = ss.getSheetByName(SULAWESI_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Sheet "${SULAWESI_SHEET}" tidak ditemukan!`);
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => cleanHeader(h));

  const colTanggal = findCol(headers, 'Tanggal');
  const colNopol = findCol(headers, 'No Polisi');
  const colDriver = findCol(headers, 'Driver');
  const colTujuan = findCol(headers, 'Tujuan');
  const colActual = findCol(headers, 'Actual');           // Actual (umum) = keluar pool
  const colUnloading = findCol(headers, 'Actual Unloading');
  const colBackToPool = findCol(headers, 'Actual Back To Pool');
  const colStatusLt = findCol(headers, 'Status LeadTime Delivery');

  if (colTanggal === -1 || colNopol === -1 || colDriver === -1) {
    SpreadsheetApp.getUi().alert('Header tidak cocok: Tanggal / No Polisi / Driver tidak ditemukan.');
    return;
  }

  // Map index kolom untuk tiap lokasi (berangkat & pulang)
  const goCols = GO_LOCATIONS.map(loc => ({ loc, idx: findCol(headers, `Actual (${loc})`) }));
  const returnCols = RETURN_LOCATIONS.map(loc => ({ loc, idx: findCol(headers, `Actual (${loc})`) }));
  const unloadingIdx = colUnloading;

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawTanggal = row[colTanggal];
    if (!rawTanggal) continue;

    // Parse tanggal → ISO
    const date = rawTanggal instanceof Date
      ? Utilities.formatDate(rawTanggal, tz, 'yyyy-MM-dd')
      : parseTanggalText(rawTanggal);
    if (!date) continue;

    const nopol = String(row[colNopol] || '').trim().toUpperCase();
    const driver = String(row[colDriver] || '').trim();
    if (!nopol || !driver) continue;

    const cp = {};
    // Waktu keluar pool
    if (colActual > -1) {
      const v = formatDateRaw(row[colActual]);
      if (v) cp['Actual OutPool'] = v;
    }
    // Tiap lokasi berangkat
    goCols.forEach(({ loc, idx }) => {
      if (idx === -1) return;
      const v = formatDateRaw(row[idx]);
      if (v) cp[`Actual (${loc})`] = v;
    });
    // Unloading
    if (unloadingIdx > -1) {
      const v = formatDateRaw(row[unloadingIdx]);
      if (v) cp['Actual Unloading'] = v;
    }
    // Tiap lokasi pulang (tambah " PULANG")
    returnCols.forEach(({ loc, idx }) => {
      if (idx === -1) return;
      const v = formatDateRaw(row[idx]);
      if (v) cp[`Actual (${loc} PULANG)`] = v;
    });
    // Kembali ke pool
    if (colBackToPool > -1) {
      const v = formatDateRaw(row[colBackToPool]);
      if (v) cp['Actual BackToPool'] = v;
    }
    // Metadata
    if (colTujuan > -1) {
      const t = String(row[colTujuan] || '').trim();
      if (t) cp['TUJUAN'] = t;
    }
    if (colStatusLt > -1) {
      const st = String(row[colStatusLt] || '').trim();
      if (st) cp['STATUS'] = st;
    }

    if (Object.keys(cp).length === 0) continue;

    rows.push({
      tanggal: date,
      area: AREA,
      driver: driver,
      no_polisi: nopol,
      shift: 'DAY SHIFT',
      ritase_ke: 'RIT 1',
      checkpoints: cp,
      status_info: {},
    });
  }

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('❌ 0 data valid ditemukan.');
    return;
  }

  const uniqueDates = [...new Set(rows.map(r => r.tanggal))];
  // Delete data SULAWESI per tanggal, lalu insert ulang
  callSyncBatched('leadtimes', 'delete_then_insert', rows, {
    tanggal: uniqueDates,
    area: [AREA],
  });

  SpreadsheetApp.getUi().alert(`✅ SYNC SULAWESI BERHASIL!\nTotal ${rows.length} baris.`);
}

function parseTanggalText(v) {
  const s = String(v).trim();
  // "DD/MM/YYYY" atau "DD/MM/YYYY HH:MM"
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  // "DD Mon YYYY"
  const dmon = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dmon) {
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const m = months[dmon[2].toLowerCase().slice(0, 3)];
    if (m) return `${dmon[3]}-${String(m).padStart(2, '0')}-${String(dmon[1]).padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Utilities.formatDate(d, 'GMT+7', 'yyyy-MM-dd');
}
