// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — FILE: SYNC KALIMANTAN (trips + leadtimes)
//
// Project Apps Script spreadsheet Monitoring berisi 4 file:
//   1. send data       → file UTAMA: onOpen + callSync/callSyncBatched + konstanta
//                        + getAllDriversMap + sync trips/leadtime JBK dkk
//   2. otomatisasi     → tidak ada kode sync, biarkan
//   3. sync sulawesi   → cuma syncLeadTimeSulawesi + helper-nya
//   4. sync kalimantan → file INI: syncKalimantanTrips + syncKalimantanLeadtime
//                        + helper-nya (tanpa onOpen)
//
// CATATAN PENTING:
//   - TIDAK ada onOpen di file ini (onOpen cuma di "send data").
//   - callSyncBatched + getAllDriversMap dipakai dari file "send data"
//     (satu project = satu scope, otomatis bisa akses).
//   - Menu "Sinkron Trips/LeadTime Kalimantan" ada di onOpen "send data".
//   - Sheet: "Monitoring TAM Kalimantan" (ketik persis, atau mengandung
//     kata KALIMANTAN). Rute round-trip kayak SULAWESI: berangkat
//     KM 38 → RING ROAD SAMARINDA → GUNUNG MENANGIS → Unloading,
//     lalu pulang urutan sebaliknya + suffix " PULANG".
//   - Yang DISIMPAN cuma kolom Actual + evaluasi/status. PLAN waypoint,
//     POSISI (GPS), KONDISI, Driving Pattern, Selisih Waktu sengaja
//     nggak disimpan — timeline LeadTimePage cuma baca Actual.
// ═══════════════════════════════════════════════════════════════════════════════

const KALIMANTAN_AREA = 'KALIMANTAN';

// Urutan rute (nama pendek — dipakai sebagai key checkpoints & timeline frontend)
const KAL_GO = ['KM 38', 'RING ROAD SAMARINDA', 'GUNUNG MENANGIS'];
const KAL_RETURN = ['GUNUNG MENANGIS', 'RING ROAD SAMARINDA', 'KM 38'];

// ── Helpers (self-contained, kecuali callSyncBatched & getAllDriversMap) ───────
function kalNorm(h) {
  return String(h || '').toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function kalFindExact(headers, name) {
  const t = kalNorm(name);
  for (let i = 0; i < headers.length; i++) {
    if (kalNorm(headers[i]) === t) return i;
  }
  return -1;
}

// Cari kolom yang header-nya mengandung SEMUA keywords dan TIDAK mengandung
// satupun excludes. Contoh actual berangkat KM 38 → (['ACTUAL','KM 38'], ['PULANG'])
function kalFindIncludes(headers, keywords, excludes) {
  const kws = keywords.map(kalNorm);
  const exs = (excludes || []).map(kalNorm);
  for (let i = 0; i < headers.length; i++) {
    const h = kalNorm(headers[i]);
    if (kws.every(k => h.includes(k)) && exs.every(x => !h.includes(x))) return i;
  }
  return -1;
}

// Nilai sampah sheet yang wajib di-skip biar nggak masuk DB
function kalIsJunk(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (!s || s === '-' || s === '0') return true;
  if (s.charAt(0) === '#') return true;               // #REF! #N/A #DIV/0! ...
  if (/^TIDAK\s+(LEWAT|ADA)$/i.test(s)) return true;  // checkpoint nggak dilewati
  return false;
}

function kalText(v) {
  if (v instanceof Date) return null; // Date di-handle caller
  const s = String(v == null ? '' : v).trim();
  return kalIsJunk(s) ? null : s;
}

// "2 Januari 2026" / "03 Januari 2026 19:00" → "yyyy-MM-dd" (bulan Indonesia)
function kalParseTanggal(v, tz) {
  if (!v) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  const months = { januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06', juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12' };
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mm = months[m[2].toLowerCase()];
    if (mm) return m[3] + '-' + mm + '-' + String(m[1]).padStart(2, '0');
  }
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    let yyyy = parseInt(m[3], 10);
    if (yyyy < 100) yyyy += 2000;
    return yyyy + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

// Ambil "HH:MM" dari Date atau teks "02/01/2026 08:55" (buat tabel trips)
function kalTime(v, tz) {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : Utilities.formatDate(v, tz, 'HH:mm');
  }
  if (kalIsJunk(v)) return null;
  const mt = String(v).match(/(\d{1,2}):(\d{2})/);
  return mt ? mt[1].padStart(2, '0') + ':' + mt[2] : null;
}

function kalGetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Monitoring TAM Kalimantan');
  if (!sheet) {
    const found = ss.getSheets().filter(s => s.getName().toUpperCase().includes('KALIMANTAN'));
    sheet = found.length > 0 ? found[0] : null;
  }
  return sheet;
}

// Petakan header sekali → index kolom (tahan typo "Unlaoding", beda spasi/titik)
function kalResolveCols(headers) {
  const exactNoPolisi = kalFindExact(headers, 'No. Polisi');
  return {
    tanggal: kalFindExact(headers, 'Tanggal'),
    nopol: exactNoPolisi > -1 ? exactNoPolisi : kalFindIncludes(headers, ['POLISI']),
    driver: kalFindExact(headers, 'Driver'),
    shift: kalFindExact(headers, 'Shift'),
    tujuan: kalFindExact(headers, 'Tujuan'),
    estimasi: kalFindIncludes(headers, ['ESTIMASI']),
    outpool: kalFindIncludes(headers, ['ACTUAL', 'OUTPOOL']),
    evalOutpool: kalFindExact(headers, 'Evaluasi OutPool'),
    reasonOutpool: kalFindExact(headers, 'Reason Delay OutPool'),
    pdc: kalFindExact(headers, 'PDC'),
    planMuat: kalFindIncludes(headers, ['PLAN', 'MUAT']),
    inPdc: kalFindExact(headers, 'IN PDC'),
    outPdc: kalFindExact(headers, 'Out PDC'),
    evalCC: kalFindExact(headers, 'Evaluasi Kedatangan CC'),
    reasonPdc: kalFindExact(headers, 'Reason Delay PDC'),
    abnormality: kalFindIncludes(headers, ['ABNORMALITY']),
    goKM38: kalFindIncludes(headers, ['ACTUAL', 'KM 38'], ['PULANG']),
    goRingRoad: kalFindIncludes(headers, ['ACTUAL', 'RING ROAD'], ['PULANG']),
    goGunung: kalFindIncludes(headers, ['ACTUAL', 'GUNUNG'], ['PULANG']),
    planUnload: kalFindIncludes(headers, ['PLAN', 'UNLOADING']),
    actualUnload: kalFindIncludes(headers, ['ACTUAL', 'UNLOA']),
    pulGunung: kalFindIncludes(headers, ['ACTUAL', 'PULANG', 'GUNUNG']),
    pulRingRoad: kalFindIncludes(headers, ['ACTUAL', 'PULANG', 'RING']),
    pulKM38: kalFindIncludes(headers, ['ACTUAL', 'PULANG', 'KM 38']),
    statusDelivery: kalFindIncludes(headers, ['STATUS', 'DELIVERY']),
    reasonDelivery: kalFindIncludes(headers, ['REASON', 'DELIVERY']),
    actualBTP: kalFindIncludes(headers, ['ACTUAL', 'BACK TO POOL']),
    statusBTP: kalFindIncludes(headers, ['STATUS', 'BACK TO POOL']),
    reasonBTP: kalFindIncludes(headers, ['REASON', 'BACK']),
  };
}

// ── Sync TRIPS Kalimantan ──────────────────────────────────────────────────────
function syncKalimantanTrips() {
  const sheet = kalGetSheet();
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "Monitoring TAM Kalimantan" tidak ditemukan!');
    return;
  }
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const driversMap = getAllDriversMap();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('❌ Sheet kosong.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const C = kalResolveCols(headers);
  if (C.tanggal === -1 || C.nopol === -1 || C.driver === -1) {
    SpreadsheetApp.getUi().alert('Header tidak cocok: Tanggal / No. Polisi / Driver tidak ditemukan.');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const displayData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  const masterData = {};

  data.forEach((row, idx) => {
    const displayRow = displayData[idx];
    const date = kalParseTanggal(row[C.tanggal], tz);
    const nopol = C.nopol > -1 ? String(displayRow[C.nopol] || '').trim().toUpperCase() : '';
    const driverName = C.driver > -1 ? String(displayRow[C.driver] || '').trim().replace(/\s+/g, ' ') : '';
    if (!date || !nopol || !driverName) return;
    const driverUuid = driversMap[driverName.toUpperCase()];
    if (!driverUuid) return; // driver belum terdaftar di tabel drivers → skip kayak area lain

    const shift = C.shift > -1 ? (String(displayRow[C.shift] || '').trim() || 'DAY SHIFT') : 'DAY SHIFT';
    const ritase = 'RIT 1'; // sheet Kalimantan tanpa kolom ritase (1 baris = 1 trip)
    const cleanId = KALIMANTAN_AREA + '-' + nopol + '-' + date + '-' + shift.replace(/\s+/g, '') + '-' + ritase.replace(/\s+/g, '');
    const str = (i) => (i > -1 ? String(displayRow[i] || '').trim() : '');

    masterData[cleanId] = {
      id: cleanId,
      driver_id: driverUuid,
      area: KALIMANTAN_AREA,
      tanggal: date,
      no_polisi: nopol,
      shift: shift,
      ritase_no: ritase,
      actual_outpool: C.outpool > -1 ? kalTime(row[C.outpool], tz) : null,
      pdc_muat: str(C.pdc),
      plan_dccp: C.planMuat > -1 ? kalTime(row[C.planMuat], tz) : null,
      actual_in_pdc: C.inPdc > -1 ? kalTime(row[C.inPdc], tz) : null,
      actual_out_pdc: C.outPdc > -1 ? kalTime(row[C.outPdc], tz) : null,
      pdc_bongkar: str(C.tujuan),
      plan_unloading: C.planUnload > -1 ? kalTime(row[C.planUnload], tz) : null,
      actual_unloading: C.actualUnload > -1 ? kalTime(row[C.actualUnload], tz) : null,
    };
  });

  const finalBatch = Object.values(masterData);
  if (finalBatch.length === 0) {
    SpreadsheetApp.getUi().alert('❌ 0 data trips valid (cek driver terdaftar & format tanggal).');
    return;
  }

  const uniqueDates = [...new Set(finalBatch.map(r => r.tanggal))];
  callSyncBatched('trips', 'delete_then_insert', finalBatch, {
    tanggal: uniqueDates,
    area: [KALIMANTAN_AREA],
  });
  SpreadsheetApp.getUi().alert('✅ SYNC TRIPS KALIMANTAN BERHASIL!\nTotal ' + finalBatch.length + ' baris.');
}

// ── Sync LEADTIMES Kalimantan (dual-write: checkpoints + status_info) ──────────
function syncKalimantanLeadtime() {
  const sheet = kalGetSheet();
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "Monitoring TAM Kalimantan" tidak ditemukan!');
    return;
  }
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const driversMap = getAllDriversMap();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('❌ Sheet kosong.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const C = kalResolveCols(headers);
  if (C.tanggal === -1 || C.nopol === -1 || C.driver === -1) {
    SpreadsheetApp.getUi().alert('Header tidak cocok: Tanggal / No. Polisi / Driver tidak ditemukan.');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const displayData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  const rows = [];

  const goIdx = [C.goKM38, C.goRingRoad, C.goGunung];
  const pulIdx = [C.pulGunung, C.pulRingRoad, C.pulKM38];

  data.forEach((row, idx) => {
    const displayRow = displayData[idx];
    const date = kalParseTanggal(row[C.tanggal], tz);
    const nopol = C.nopol > -1 ? String(displayRow[C.nopol] || '').trim().toUpperCase() : '';
    const driverName = C.driver > -1 ? String(displayRow[C.driver] || '').trim().replace(/\s+/g, ' ') : '';
    if (!date || !nopol || !driverName) return;

    // Teks sel: Date → "dd/MM/yyyy HH:mm", teks → apa adanya (skip sampah)
    const cellText = (i) => {
      if (i === null || i === undefined || i < 0) return null;
      const raw = row[i];
      if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? null : Utilities.formatDate(raw, tz, 'dd/MM/yyyy HH:mm');
      }
      return kalText(displayRow[i]);
    };

    const cp = {};
    const si = {};
    const putCp = (k, i) => { const v = cellText(i); if (v) cp[k] = v; };
    const putSi = (k, i) => { const v = cellText(i); if (v) si[k] = v; };

    const shift = C.shift > -1 ? (String(displayRow[C.shift] || '').trim() || 'DAY SHIFT') : 'DAY SHIFT';

    // Keluar pool + PDC
    putCp('Actual OutPool', C.outpool);
    putCp('Estimasi (LT)', C.estimasi);
    putCp('IN PDC', C.inPdc);
    putCp('Out PDC', C.outPdc);
    // Tiap titik berangkat
    KAL_GO.forEach((loc, j) => putCp('Actual (' + loc + ')', goIdx[j]));
    // Unloading (tahan typo "Unlaoding")
    putCp('Actual Unloading', C.actualUnload);
    // Tiap titik pulang (suffix " PULANG" kayak SULAWESI)
    KAL_RETURN.forEach((loc, j) => putCp('Actual (' + loc + ' PULANG)', pulIdx[j]));
    // Kembali ke pool
    putCp('Actual BackToPool', C.actualBTP);
    // Metadata (checkpoints — dipakai Route Analytics)
    const tujuan = C.tujuan > -1 ? kalText(displayRow[C.tujuan]) : null;
    if (tujuan) cp['TUJUAN'] = tujuan;
    const stDel = cellText(C.statusDelivery);
    if (stDel) cp['STATUS'] = stDel;

    // status_info — key persis yang dibaca LeadTimePage
    putSi('Evaluasi Keluar Pool', C.evalOutpool);
    putSi('Reason Delay OutPool', C.reasonOutpool);
    putSi('Evaluasi Kedatangan CC', C.evalCC);
    putSi('Reason Delay PDC', C.reasonPdc);
    putSi('Abnormality', C.abnormality);
    if (stDel) si['Status Leadtime'] = stDel;
    putSi('Reason Delay Delivery', C.reasonDelivery);
    putSi('Status Leadtime Back To Pool', C.statusBTP);
    putSi('Reason Delay BackToPool', C.reasonBTP);

    if (Object.keys(cp).length === 0 && Object.keys(si).length === 0) return;

    const payload = {
      tanggal: date,
      area: KALIMANTAN_AREA,
      driver: driverName,
      no_polisi: nopol,
      shift: shift,
      ritase_ke: 'RIT 1',
      checkpoints: cp,
      status_info: si,
    };
    const driverUuid = driversMap[driverName.toUpperCase()];
    if (driverUuid) payload.driver_id = driverUuid;
    rows.push(payload);
  });

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('❌ 0 data valid ditemukan.');
    return;
  }

  const uniqueDates = [...new Set(rows.map(r => r.tanggal))];
  // Delete per tanggal (scope sempit — bukan per-area kayak sync lama)
  callSyncBatched('leadtimes', 'delete_then_insert', rows, {
    tanggal: uniqueDates,
    area: [KALIMANTAN_AREA],
  });
  SpreadsheetApp.getUi().alert('✅ SYNC LEADTIME KALIMANTAN BERHASIL!\nTotal ' + rows.length + ' baris.');
}
