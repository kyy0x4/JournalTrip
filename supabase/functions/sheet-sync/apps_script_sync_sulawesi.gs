// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — FILE: SYNC SULAWESI
//
// Project Apps Script spreadsheet Monitoring berisi 3 file:
//   1. send data      → file UTAMA: onOpen + callSync/callSyncBatched + konstanta
//   2. otomatisasi    → tidak ada kode sync, biarkan
//   3. sync sulawesi  → file INI: cuma syncLeadTimeSulawesi + helper-nya
//
// CATATAN PENTING:
//   - TIDAK ada onOpen di file ini (onOpen cuma di "send data").
//   - TIDAK ada callSync/callSyncBatched/konstanta di sini — itu semua udah ada
//     di "send data", dan karena satu project, fungsi di sini otomatis bisa akses.
//   - Menu "Sinkron LeadTime Sulawesi" ada di onOpen "send data", memanggil
//     syncLeadTimeSulawesi yang didefinisikan di file ini.
// ═══════════════════════════════════════════════════════════════════════════════

const SULAWESI_SHEET = 'Looker Sulawesi';
const AREA = 'SULAWESI';

// Lokasi berangkat & pulang (urutan rute)
const GO_LOCATIONS = ['Pinrang', 'Majene', 'Mamuju', 'Karrosa', 'Sarjo', 'Kebon Kopi', 'Kasimbar', 'Santigi', 'Paguat'];
const RETURN_LOCATIONS = ['Paguat', 'Santigi', 'Kasimbar', 'Kebon Kopi', 'Sarjo', 'Karrosa', 'Mamuju', 'Majene', 'Pinrang'];

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
  // Kolom evaluasi/status buat LeadTimePage (status_info)
  const colEvalOutPool = findCol(headers, 'Evaluasi OutPool');
  const colReasonOutPool = findCol(headers, 'Reason Delay OutPool');
  const colEvalKedatangan = findCol(headers, 'Evaluasi Kedatangan CC');
  const colReasonPdc = findCol(headers, 'Reason Delay PDC');
  const colStatusBtp = findCol(headers, 'Status BTP');
  const colReasonBtp = findCol(headers, 'Reason Delay Back To Pool');

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
    const si = {};
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
    // Metadata (checkpoints — dipakai Route Analytics)
    if (colTujuan > -1) {
      const t = String(row[colTujuan] || '').trim();
      if (t) cp['TUJUAN'] = t;
    }
    if (colStatusLt > -1) {
      const st = String(row[colStatusLt] || '').trim();
      if (st) cp['STATUS'] = st;
    }

    // ── status_info — dipakai halaman LeadTime (flow: OutPool→InPDC→Unloading→InPool) ──
    if (colEvalOutPool > -1) {
      const v = String(row[colEvalOutPool] || '').trim();
      if (v) si['Evaluasi Keluar Pool'] = v;
    }
    if (colReasonOutPool > -1) {
      const v = String(row[colReasonOutPool] || '').trim();
      if (v) si['Reason Delay OutPool'] = v;
    }
    if (colEvalKedatangan > -1) {
      const v = String(row[colEvalKedatangan] || '').trim();
      if (v) si['Evaluasi Kedatangan CC'] = v;
    }
    if (colReasonPdc > -1) {
      const v = String(row[colReasonPdc] || '').trim();
      if (v) si['Reason Delay PDC'] = v;
    }
    if (colStatusLt > -1) {
      const v = String(row[colStatusLt] || '').trim();
      if (v) si['Status Leadtime'] = v;   // key yang dicari LeadTimePage utk delivery
    }
    if (colStatusBtp > -1) {
      const v = String(row[colStatusBtp] || '').trim();
      if (v) si['Status Leadtime Back To Pool'] = v;
    }
    if (colReasonBtp > -1) {
      const v = String(row[colReasonBtp] || '').trim();
      if (v) si['Reason Delay BackToPool'] = v;
    }

    if (Object.keys(cp).length === 0 && Object.keys(si).length === 0) continue;

    rows.push({
      tanggal: date,
      area: AREA,
      driver: driver,
      no_polisi: nopol,
      shift: 'DAY SHIFT',
      ritase_ke: 'RIT 1',
      checkpoints: cp,
      status_info: si,
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
