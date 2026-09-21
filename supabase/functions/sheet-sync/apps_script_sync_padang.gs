// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — FILE: SYNC PADANG (trips + leadtimes)
//
// Project Apps Script spreadsheet Monitoring berisi 5 file:
//   1. send data       → file UTAMA: onOpen + callSync/callSyncBatched + konstanta
//                        + getAllDriversMap + sync trips/leadtime JBK dkk
//   2. otomatisasi     → tidak ada kode sync, biarkan
//   3. sync sulawesi   → cuma syncLeadTimeSulawesi + helper-nya
//   4. sync kalimantan → syncKalimantanTrips + syncKalimantanLeadtime + helper-nya
//   5. sync padang     → file INI: syncPadangTrips + syncPadangLeadtime
//                        + helper-nya (tanpa onOpen)
//
// CATATAN PENTING:
//   - TIDAK ada onOpen di file ini (onOpen cuma di "send data").
//   - callSyncBatched + getAllDriversMap dipakai dari file "send data"
//     (satu project = satu scope, otomatis bisa akses).
//   - Menu "Sinkron Trips/LeadTime Padang" ada di onOpen "send data".
//   - Sheet: "Monitoring TAM Padang" (ketik persis, atau mengandung kata PADANG).
//   - BEDA dari area lain: tiap stage punya PLAN + ACTUAL sendiri
//     (Keluar Pool, Tiba PDC, Loading PDC, Out PDC, tiap RM, Unloading).
//     Keduanya disimpan (key "Plan ..." + "Actual ...") biar timeline
//     LeadTimePage bisa bandingin plan vs actual per titik.
//   - Blok RM: "Plan In RM X" = anchor, lalu +1 Plan Out, +2 Actual In,
//     +3 Actual OUT, +4 Durasi, +5 Keterangan, +6 Issue. Rute Padang &
//     Jambi pakai RM BMW; rute Padang pakai AREMA/DAMAS/SIJUNJUNG;
//     rute Lubuk Linggau pakai MUSI/MUARA LAKITAN. Yang TIDAK LEWAT
//     otomatis ke-skip (nggak masuk DB).
//   - Yang DISIMPAN cuma Plan/Actual + Keterangan/Issue per stage.
//     Selisih Waktu, Durasi, Leadtime Delivery, Jam Calling, POSISI (GPS),
//     KONDISI, Driving Pattern sengaja nggak disimpan.
// ═══════════════════════════════════════════════════════════════════════════════

const PADANG_AREA = 'PADANG';

// RM berangkat (nama pendek — dipakai sebagai key checkpoints & timeline frontend)
const PAD_RM_GO = [
  { key: 'RM BMW', words: ['BMW'] },
  { key: 'RM AREMA', words: ['AREMA'] },
  { key: 'RM DAMAS RAYA', words: ['DAMAS'] },
  { key: 'RM SIJUNJUNG', words: ['SIJUNJUNG'] },
  { key: 'RM MUSI BANYU ASIN', words: ['MUSI'] },
  { key: 'RM MUARA LAKITAN', words: ['MUARA', 'LAKITAN'] },
];
// Pulang = urutan balik + suffix " PULANG"
const PAD_RM_RETURN = [
  { key: 'RM MUARA LAKITAN PULANG', words: ['MUARA', 'LAKITAN'] },
  { key: 'RM MUSI BANYU ASIN PULANG', words: ['MUSI'] },
  { key: 'RM SIJUNJUNG PULANG', words: ['SIJUNJUNG'] },
  { key: 'RM DAMAS RAYA PULANG', words: ['DAMAS'] },
  { key: 'RM AREMA PULANG', words: ['AREMA'] },
  { key: 'RM BMW PULANG', words: ['BMW'] },
];

// ── Helpers (prefix pad* — biar nggak tabrakan sama file lain satu project) ───
function padNorm(h) {
  return String(h || '').toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

// Pecah header jadi kata-kata (tanda kurung/koma dibuang) — buat matching kata utuh.
// "Plan Out RM BMW (SUNGAI LILIN)" → [PLAN, OUT, RM, BMW, SUNGAI, LILIN]
function padWords(h) {
  return padNorm(h).replace(/[()&,]/g, ' ').split(/\s+/).filter(Boolean);
}

function padFindExact(headers, name) {
  const t = padNorm(name);
  for (let i = 0; i < headers.length; i++) {
    if (padNorm(headers[i]) === t) return i;
  }
  return -1;
}

// Cari kolom yang kata-katanya mengandung SEMUA required dan TIDAK mengandung
// satupun excluded. Kata utuh (bukan substring) — "IN" nggak ketemu di "LILIN".
function padFind(headers, required, excluded) {
  const exs = excluded || [];
  for (let i = 0; i < headers.length; i++) {
    const w = padWords(headers[i]);
    if (required.every(k => w.includes(k)) && exs.every(x => !w.includes(x))) return i;
  }
  return -1;
}

// Nilai sampah sheet yang wajib di-skip biar nggak masuk DB
function padIsJunk(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (!s || s === '-' || s === '0') return true;
  if (s.charAt(0) === '#') return true;               // #REF! #N/A #DIV/0! ...
  if (/^TIDAK\s+(LEWAT|ADA)$/i.test(s)) return true;  // checkpoint nggak dilewati
  return false;
}

function padText(v) {
  if (v instanceof Date) return null; // Date di-handle caller
  const s = String(v == null ? '' : v).trim();
  return padIsJunk(s) ? null : s;
}

// "2 Januari 2026" → "yyyy-MM-dd" (bulan Indonesia)
function padParseTanggal(v, tz) {
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

// Ambil "HH:MM" dari Date atau teks "2/1/2026 09:31:00" (buat tabel trips)
function padTime(v, tz) {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : Utilities.formatDate(v, tz, 'HH:mm');
  }
  if (padIsJunk(v)) return null;
  const mt = String(v).match(/(\d{1,2}):(\d{2})/);
  return mt ? mt[1].padStart(2, '0') + ':' + mt[2] : null;
}

function padGetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Monitoring TAM Padang');
  if (!sheet) {
    const found = ss.getSheets().filter(s => s.getName().toUpperCase().includes('PADANG'));
    sheet = found.length > 0 ? found[0] : null;
  }
  return sheet;
}

// Petakan header sekali → index kolom. Keterangan/Issue diambil via OFFSET dari
// anchor Plan (+3 Keterangan, +4 Issue) karena header-nya kembar semua.
function padResolveCols(headers) {
  const planOutpool = padFind(headers, ['PLAN', 'KELUAR', 'POOL'], ['ACTUAL']);
  const planTiba = padFind(headers, ['PLAN', 'TIBA'], ['ACTUAL']);
  const planLoading = padFind(headers, ['PLAN', 'LOADING'], ['ACTUAL']);
  const planOutPdc = padFind(headers, ['PLAN', 'OUT', 'PDC'], ['ACTUAL', 'PULANG', 'RM']);
  const planUnload = padFind(headers, ['PLAN', 'UNLOADING'], ['ACTUAL']);
  return {
    tanggal: padFindExact(headers, 'Tanggal'),
    nopol: padFind(headers, ['POLISI']),
    driver: padFindExact(headers, 'Driver'),
    shift: padFindExact(headers, 'Shift'),
    tujuan: padFindExact(headers, 'Tujuan'),
    planOutpool: planOutpool,
    planTiba: planTiba,
    planLoading: planLoading,
    planOutPdc: planOutPdc,
    abnormality: padFind(headers, ['KETERANGAN', 'ABNORMALITY']),
    planUnload: planUnload,
    outRpPadang: padFindExact(headers, 'OUT RP PADANG'),
    planBTP: padFind(headers, ['PLAN', 'BACKTOPOOL'], ['ACTUAL']),
    actualBTP: padFind(headers, ['ACTUAL', 'BACKTOPOOL'], []),
    statusBTP: padFind(headers, ['STATUS', 'BACK'], []),
    faktorBTP: padFind(headers, ['FAKTOR', 'BACK'], []),
  };
}

// Cari anchor "Plan In RM <X>" (berangkat: tanpa PULANG / pulang: wajib PULANG)
function padFindRmPlanIn(headers, rmWords, pulang) {
  for (let i = 0; i < headers.length; i++) {
    const w = padWords(headers[i]);
    if (!w.includes('PLAN') || !w.includes('IN') || w.includes('OUT')) continue;
    if (!w.includes('RM')) continue;
    if (!rmWords.every(k => w.includes(k))) continue;
    if (pulang && !w.includes('PULANG')) continue;
    if (!pulang && w.includes('PULANG')) continue;
    return i;
  }
  return -1;
}

// ── Sync TRIPS Padang ──────────────────────────────────────────────────────────
function syncPadangTrips() {
  const sheet = padGetSheet();
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "Monitoring TAM Padang" tidak ditemukan!');
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
  const C = padResolveCols(headers);
  if (C.tanggal === -1 || C.nopol === -1 || C.driver === -1) {
    SpreadsheetApp.getUi().alert('Header tidak cocok: Tanggal / No. Polisi / Driver tidak ditemukan.');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const displayData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  const masterData = {};
  const skippedDrivers = {};

  data.forEach((row, idx) => {
    const displayRow = displayData[idx];
    const date = padParseTanggal(row[C.tanggal], tz);
    const nopol = C.nopol > -1 ? String(displayRow[C.nopol] || '').trim().toUpperCase() : '';
    const driverName = C.driver > -1 ? String(displayRow[C.driver] || '').trim().replace(/\s+/g, ' ') : '';
    if (!date || !nopol || !driverName) return;
    const driverUuid = driversMap[driverName.toUpperCase()];
    // trips.driver_id wajib FK ke tabel drivers — driver baru WAJIB didaftarkan dulu
    if (!driverUuid) {
      skippedDrivers[driverName] = (skippedDrivers[driverName] || 0) + 1;
      return;
    }

    const shift = C.shift > -1 ? (String(displayRow[C.shift] || '').trim() || 'DAY SHIFT') : 'DAY SHIFT';
    const ritase = 'RIT 1'; // sheet Padang tanpa kolom ritase (1 baris = 1 trip)
    const cleanId = PADANG_AREA + '-' + nopol + '-' + date + '-' + shift.replace(/\s+/g, '') + '-' + ritase.replace(/\s+/g, '');
    const str = (i) => (i > -1 ? String(displayRow[i] || '').trim() : '');

    masterData[cleanId] = {
      id: cleanId,
      driver_id: driverUuid,
      area: PADANG_AREA,
      tanggal: date,
      no_polisi: nopol,
      shift: shift,
      ritase_no: ritase,
      actual_outpool: C.planOutpool > -1 ? padTime(row[C.planOutpool + 1], tz) : null,
      pdc_muat: 'PALEMBANG', // operasi Padang via PDC Palembang (tanpa kolom nama PDC di sheet)
      plan_dccp: C.planTiba > -1 ? padTime(row[C.planTiba], tz) : null,
      actual_in_pdc: C.planTiba > -1 ? padTime(row[C.planTiba + 1], tz) : null,
      actual_out_pdc: C.planOutPdc > -1 ? padTime(row[C.planOutPdc + 1], tz) : null,
      pdc_bongkar: str(C.tujuan),
      plan_unloading: C.planUnload > -1 ? padTime(row[C.planUnload], tz) : null,
      actual_unloading: C.planUnload > -1 ? padTime(row[C.planUnload + 1], tz) : null,
    };
  });

  const finalBatch = Object.values(masterData);
  if (finalBatch.length === 0) {
    const skipped = Object.keys(skippedDrivers).map(n => n + ' (' + skippedDrivers[n] + ' baris)').join('\n');
    SpreadsheetApp.getUi().alert(
      '❌ 0 data trips valid.\n\n' +
      (skipped
        ? 'Driver ini belum terdaftar di tabel drivers:\n' + skipped + '\n\nDaftarkan dulu:\ninsert into public.drivers (name, area) values (\'NAMA_DRIVER\', \'PADANG\');\n\nLalu Run ulang.'
        : 'Cek format kolom Tanggal (cth "2 Januari 2026").')
    );
    return;
  }

  const uniqueDates = [...new Set(finalBatch.map(r => r.tanggal))];
  callSyncBatched('trips', 'delete_then_insert', finalBatch, {
    tanggal: uniqueDates,
    area: [PADANG_AREA],
  });
  const skipped = Object.keys(skippedDrivers).map(n => n + ' (' + skippedDrivers[n] + ')').join(', ');
  SpreadsheetApp.getUi().alert(
    '✅ SYNC TRIPS PADANG BERHASIL!\nTotal ' + finalBatch.length + ' baris.' +
    (skipped ? '\n\n⚠️ Ke-skip (driver belum terdaftar): ' + skipped : '')
  );
}

// ── Sync LEADTIMES Padang (dual-write: checkpoints + status_info) ──────────────
function syncPadangLeadtime() {
  const sheet = padGetSheet();
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "Monitoring TAM Padang" tidak ditemukan!');
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
  const C = padResolveCols(headers);
  if (C.tanggal === -1 || C.nopol === -1 || C.driver === -1) {
    SpreadsheetApp.getUi().alert('Header tidak cocok: Tanggal / No. Polisi / Driver tidak ditemukan.');
    return;
  }

  // Anchor RM sekali di level header (berlaku semua baris)
  const rmGoIdx = PAD_RM_GO.map(rm => padFindRmPlanIn(headers, rm.words, false));
  const rmPulIdx = PAD_RM_RETURN.map(rm => padFindRmPlanIn(headers, rm.words, true));

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const displayData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  const rows = [];

  data.forEach((row, idx) => {
    const displayRow = displayData[idx];
    const date = padParseTanggal(row[C.tanggal], tz);
    const nopol = C.nopol > -1 ? String(displayRow[C.nopol] || '').trim().toUpperCase() : '';
    const driverName = C.driver > -1 ? String(displayRow[C.driver] || '').trim().replace(/\s+/g, ' ') : '';
    if (!date || !nopol || !driverName) return;

    // Teks sel: Date → "dd/MM/yyyy HH:mm", teks → apa adanya (skip sampah)
    const cellText = (i) => {
      if (i === null || i === undefined || i < 0 || i >= row.length) return null;
      const raw = row[i];
      if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? null : Utilities.formatDate(raw, tz, 'dd/MM/yyyy HH:mm');
      }
      return padText(displayRow[i]);
    };

    const cp = {};
    const si = {};
    const putCp = (k, i) => { const v = cellText(i); if (v) cp[k] = v; };
    const putSi = (k, i) => { const v = cellText(i); if (v) si[k] = v; };

    const shift = C.shift > -1 ? (String(displayRow[C.shift] || '').trim() || 'DAY SHIFT') : 'DAY SHIFT';

    // Tiap stage: Plan (anchor) + Actual (+1), Keterangan (+3), Issue (+4)
    const putStage = (planKey, actualKey, siKetKey, siIssueKey, anchor) => {
      if (anchor === null || anchor === undefined || anchor < 0) return;
      putCp(planKey, anchor);
      putCp(actualKey, anchor + 1);
      putSi(siKetKey, anchor + 3);
      putSi(siIssueKey, anchor + 4);
    };

    putStage('Plan Keluar Pool', 'Actual Keluar Pool', 'Evaluasi Keluar Pool', 'Reason Delay OutPool', C.planOutpool);
    putStage('Plan Tiba PDC', 'Actual Tiba PDC', 'Evaluasi Kedatangan CC', 'Reason Delay PDC', C.planTiba);
    putStage('Plan Loading PDC', 'Actual Loading PDC', 'Keterangan Loading', 'Reason Delay Loading', C.planLoading);
    putStage('Plan Out PDC', 'Actual Out PDC', 'Keterangan Out PDC', 'Reason Delay Out PDC', C.planOutPdc);

    putSi('Abnormality', C.abnormality);

    // Tiap RM berangkat: Plan In/Out + Actual In/Out, Keterangan, Issue
    PAD_RM_GO.forEach((rm, j) => {
      const p = rmGoIdx[j];
      if (p < 0) return;
      putCp('Plan In (' + rm.key + ')', p);
      putCp('Plan Out (' + rm.key + ')', p + 1);
      putCp('Actual In (' + rm.key + ')', p + 2);
      putCp('Actual Out (' + rm.key + ')', p + 3);
      putSi('Keterangan (' + rm.key + ')', p + 5);
      putSi('Issue (' + rm.key + ')', p + 6);
    });

    // Unloading — Keterangan-nya jadi Status Leadtime (dibaca LeadTimePage)
    if (C.planUnload > -1) {
      putCp('Plan Unloading', C.planUnload);
      putCp('Actual Unloading', C.planUnload + 1);
      const ketUnload = cellText(C.planUnload + 3);
      if (ketUnload) si['Status Leadtime'] = ketUnload;
      putSi('Reason Delay Delivery', C.planUnload + 4);
    }

    putCp('OUT RP PADANG', C.outRpPadang);

    // Tiap RM pulang (suffix " PULANG" kayak SULAWESI)
    PAD_RM_RETURN.forEach((rm, j) => {
      const p = rmPulIdx[j];
      if (p < 0) return;
      const base = rm.key.replace(' PULANG', '');
      putCp('Plan In (' + rm.key + ')', p);
      putCp('Plan Out (' + rm.key + ')', p + 1);
      putCp('Actual In (' + rm.key + ')', p + 2);
      putCp('Actual Out (' + rm.key + ')', p + 3);
      putSi('Keterangan (' + rm.key + ')', p + 5);
      putSi('Issue (' + rm.key + ')', p + 6);
    });

    // Kembali ke pool
    putCp('Plan BackToPool', C.planBTP);
    putCp('Actual BackToPool', C.actualBTP);
    putSi('Status Leadtime Back To Pool', C.statusBTP);
    putSi('Reason Delay BackToPool', C.faktorBTP);

    // Metadata (checkpoints — dipakai Route Analytics)
    const tujuan = C.tujuan > -1 ? padText(displayRow[C.tujuan]) : null;
    if (tujuan) cp['TUJUAN'] = tujuan;

    if (Object.keys(cp).length === 0 && Object.keys(si).length === 0) return;

    const payload = {
      tanggal: date,
      area: PADANG_AREA,
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
    area: [PADANG_AREA],
  });
  SpreadsheetApp.getUi().alert('✅ SYNC LEADTIME PADANG BERHASIL!\nTotal ' + rows.length + ' baris.');
}
