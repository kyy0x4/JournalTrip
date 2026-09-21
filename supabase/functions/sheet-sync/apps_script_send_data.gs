// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — FILE UTAMA: SEND DATA (trips + leadtimes monitoring)
//
// Project Apps Script spreadsheet Monitoring berisi 4 file:
//   1. send data      → file INI (onOpen + callSync + sync trips/leadtime)
//   2. otomatisasi    → tidak ada kode sync, biarkan
//   3. sync sulawesi  → cuma berisi syncLeadTimeSulawesi + helper-nya (tanpa onOpen)
//   4. sync kalimantan → syncKalimantanTrips + syncKalimantanLeadtime + helper-nya
//                        (tanpa onOpen; sheet "Monitoring TAM Kalimantan")
//   5. sync padang     → syncPadangTrips + syncPadangLeadtime + helper-nya
//                        (tanpa onOpen; sheet "Monitoring TAM Padang")
//
// CATATAN PENTING:
//   - Hanya SATU onOpen per project (ada di file ini).
//   - callSync/callSyncBatched & konstanta cuma di file ini — file sulawesi
//     otomatis bisa akses karena satu project.
//   - Sinkron LeadTime SULAWESI dipanggil dari menu di sini, fungsinya di file
//     "sync sulawesi".
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
// WRITE_KEY diambil dari Script Properties (Project Settings → Script Properties),
// bukan hardcode di kode — biar editor nggak langsung lihat key-nya.
const WRITE_KEY = PropertiesService.getScriptProperties().getProperty('WRITE_KEY') || '2b2ead6dd73632d797ac84bf4fbdbdbc359cc94ff163b0defd36e834d883b55e';
const CALLSYNC_BATCH = 500;

// Untuk operasi BACA saja (getAllDriversMap). Anon key aman dipakai di client
// karena RLS membatasi cuma SELECT. Bukan service_role!
const SUPABASE_URL = 'https://tdtywoejybnunxyqzmst.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tw6kojTfpCtKpk7hmAGSPQ_0MqvWpiF';

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 SYNC DASHBOARD')
    .addItem('🔄 Sinkron Ritase (Ke Trips)', 'uploadSemuaArea')
    .addItem('⏱️ Sinkron Leadtime (Ke Leadtimes)', 'uploadLeadtimeAll')
    .addSeparator()
    .addItem('⏱️ Sinkron LeadTime Sulawesi', 'syncLeadTimeSulawesi')
    .addItem('🇮🇩 Sinkron Trips Kalimantan', 'syncKalimantanTrips')
    .addItem('⏱️ Sinkron LeadTime Kalimantan', 'syncKalimantanLeadtime')
    .addItem('🏔️ Sinkron Trips Padang', 'syncPadangTrips')
    .addItem('⏱️ Sinkron LeadTime Padang', 'syncPadangLeadtime')
    .addSeparator()
    .addItem('🗑️ Hapus Webhook Log', 'clearWebhookLog')
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

// ─── 1. SINKRON KE TABLE: trips (delete per area, lalu insert ulang) ──────────
function uploadSemuaArea() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const driversMap = getAllDriversMap();
  let totalSuccess = 0;
  let failed = [];

  ss.getSheets().forEach(sheet => {
    const sheetName = sheet.getName();
    const cfg = getColumnConfig(sheetName);
    if (!cfg || sheet.isSheetHidden()) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const displayData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();

    let masterData = {};
    data.forEach((row, idx) => {
      const displayRow = displayData[idx];
      if (row[cfg.tgl] && row[cfg.nopol] && row[cfg.driver]) {
        const driverUuid = driversMap[row[cfg.driver].toString().replace(/\s+/g, ' ').trim().toUpperCase()];
        if (driverUuid) {
          const payload = mapToTripsTable(row, displayRow, driverUuid, cfg);
          if (payload) masterData[payload.id] = payload;
        }
      }
    });

    const finalBatch = Object.values(masterData);
    if (finalBatch.length > 0) {
      try {
        SpreadsheetApp.getActiveSpreadsheet().toast('⏳ Sync ' + sheetName + ' (' + finalBatch.length + ' rows)...', 'PROSES');
        // Sheet gabungan (mixed): hapus kedua area sekaligus biar nggak ada sisa
        const delArea = cfg.mixed ? [cfg.area, 'DOUBLE DECK'] : cfg.area;
        callSyncBatched('trips', 'delete_then_insert', finalBatch, { area: delArea });
        totalSuccess += finalBatch.length;
      } catch (e) {
        failed.push(sheetName + ': ' + e.message);
      }
      Utilities.sleep(800);
    }
  });
  if (failed.length > 0) {
    SpreadsheetApp.getUi().alert('⚠️ SUKSES SEBAGIAN\n\nBerhasil: ' + totalSuccess + ' rows\nGagal:\n' + failed.join('\n') + '\n\nCoba Run lagi sheet yang gagal saja.');
  } else {
    ss.toast('Selesai! ' + totalSuccess + ' Data Trips Sinkron.', 'SUKSES');
  }
}

// ─── 2. SINKRON KE TABLE: leadtimes (delete per area, lalu insert ulang) ──────
function uploadLeadtimeAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const driversMap = getAllDriversMap();
  let totalSuccess = 0;
  let failed = [];

  ss.getSheets().forEach(sheet => {
    const sheetName = sheet.getName();
    const cfg = getColumnConfig(sheetName);
    if (!cfg || sheet.isSheetHidden()) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const displayData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();

    const finalBatch = [];
    data.forEach((row, idx) => {
      const displayRow = displayData[idx];
      if (row[cfg.tgl] && row[cfg.nopol] && row[cfg.driver]) {
        const driverUuid = driversMap[row[cfg.driver].toString().replace(/\s+/g, ' ').trim().toUpperCase()];
        if (driverUuid) {
          const payload = mapToLeadtimesTable(row, displayRow, headers, cfg, driverUuid);
          if (payload) finalBatch.push(payload);
        }
      }
    });

    if (finalBatch.length > 0) {
      try {
        SpreadsheetApp.getActiveSpreadsheet().toast('⏳ Sync ' + sheetName + ' (' + finalBatch.length + ' rows)...', 'PROSES');
        const delArea = cfg.mixed ? [cfg.area, 'DOUBLE DECK'] : cfg.area;
        callSyncBatched('leadtimes', 'delete_then_insert', finalBatch, { area: delArea });
        totalSuccess += finalBatch.length;
      } catch (e) {
        failed.push(sheetName + ': ' + e.message);
      }
      Utilities.sleep(800);
    }
  });
  if (failed.length > 0) {
    SpreadsheetApp.getUi().alert('⚠️ SUKSES SEBAGIAN\n\nBerhasil: ' + totalSuccess + ' rows\nGagal:\n' + failed.join('\n') + '\n\nCoba Run lagi sheet yang gagal saja.');
  } else {
    ss.toast('Selesai! ' + totalSuccess + ' Data Leadtimes Sinkron.', 'SUKSES');
  }
}

// ─── 3. HELPERS ─────────────────────────────────────────────────────────────
function getAllDriversMap() {
  // Baca daftar driver. Karena anon boleh SELECT, ini bisa pakai anon key
  // yang ada di .env project — ATAU lebih aman, lewat edge function juga.
  // (Paling simpel: tetap pakai supabase anon key di sini, karena cuma baca.)
  const url = SUPABASE_URL + '/rest/v1/drivers?select=id,name';
  const options = { "headers": { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY } };
  const map = {};
  JSON.parse(UrlFetchApp.fetch(url, options).getContentText()).forEach(d => {
    map[d.name.toUpperCase()] = d.id;
  });
  return map;
}

// ── getColumnConfig, mapToTripsTable, mapToLeadtimesTable, formatDateClean,
//    formatTime, clearWebhookLog → sama persis seperti script asli ──

function getColumnConfig(sheetName) {
  const name = sheetName.trim().toUpperCase();
  if (!name.includes("MONITORING")) return null;

  if (name.includes("JBK")) {
    return {
      area: "JBK",
      tgl: 0,        // A
      nopol: 2,      // C
      driver: 3,     // D
      shift: 5,      // F
      ritase: 6,     // G
      outpool: 9,    // J
      pdc_muat: 12,  // M
      plan_dccp: 13, // N
      in_pdc: 14,    // O
      out_pdc: 16,   // Q
      pdc_bongkar: 30, // AE
      plan_unload: 31, // AF
      actual_unload: 32 // AG
    };
  } else if (name.includes("NGORO")) {
    return {
      area: "NGORO",
      tgl: 0,        // A
      nopol: 1,      // B
      driver: 2,     // C
      shift: 5,      // F
      ritase: null,
      outpool: 8,    // I
      pdc_muat: 11,  // L
      plan_dccp: 12, // M (PLAN)
      in_pdc: 13,    // N (IN PDC)
      out_pdc: 15,   // P (Out PDC)
      pdc_bongkar: 4,  // E (Tujuan / Bongkar)
      plan_unload: 38, // AM (Plan Unloading)
      actual_unload: 39 // AN (Actual Unloading)
    };
  } else if (name.includes("TMMIN")) {
    return {
      area: "TMMIN",
      tgl: 1,          // B
      nopol: 3,        // D
      driver: 4,       // E
      shift: 6,        // G
      ritase: 7,       // H
      outpool: 10,     // K
      pdc_muat: 12,    // M
      plan_dccp: 13,   // N
      in_pdc: 14,      // O
      out_pdc: 15,     // P (Fixed index)
      pdc_bongkar: 27, // AB
      plan_unload: 28, // AC
      actual_unload: 29 // AD
    };
  } else if (name.includes("SINGLE CARRIER")) {
    // Sheet gabungan Single Carrier + Double Deck (1 sheet, tanpa kolom area).
    // Area diputus per baris by nopol di mapToTripsTable/mapToLeadtimesTable.
    return {
      area: "SINGLE CARRIER",
      mixed: true,
      tgl: 1,          // B: Tanggal
      nopol: 2,        // C: Nopol
      driver: 3,       // D: Driver
      shift: 5,        // F: Shift
      ritase: 6,       // G: Ritase ke
      outpool: 9,      // J: Actual OutPool
      pdc_muat: 10,    // K: PDC Muat
      plan_dccp: 14,   // O: Plan DCCP
      in_pdc: 12,      // M: In PDC
      out_pdc: 18,     // S: Out PDC
      pdc_bongkar: 21, // V: PDC Bongkar
      plan_unload: 22, // W: Plan Unloading
      actual_unload: 23 // X: Actual Unloading
    };
  } else if (name.includes("SUMATRA") || name.includes("SUMATERA") || name.includes("JAKARTA POLYGON")) {
    return {
      area: "SUMATERA",
      tgl: 0,          // A
      nopol: 1,        // B
      driver: 2,       // C
      shift: null,
      ritase: null,
      outpool: 7,      // H
      pdc_muat: 10,    // K
      plan_dccp: 11,   // L
      in_pdc: 12,      // M
      out_pdc: 13,     // N
      pdc_bongkar: 4,  // E
      plan_unload: null,
      actual_unload: 27 // AB (UNLOADING PDC POLYGON)
    };
  }
  return null;
}

// Nopol Double Deck (satu-satunya unit DD, gabung di sheet Single Carrier)
const DOUBLE_DECK_NOPOLS = ["B 9951 KIN"];

function resolveMixedArea(nopol, cfg) {
  if (!cfg.mixed) return cfg.area;
  const n = (nopol || "").toString().trim().toUpperCase().replace(/\s+/g, ' ');
  return DOUBLE_DECK_NOPOLS.includes(n) ? "DOUBLE DECK" : "SINGLE CARRIER";
}

function mapToTripsTable(row, displayRow, driverId, cfg) {
  let date = formatDateClean(row[cfg.tgl]);
  if (!date) return null;
  const nopol = displayRow[cfg.nopol]?.toString().trim() || "UNKNOWN";
  const area = resolveMixedArea(nopol, cfg);
  const ritase = cfg.ritase !== null ? (displayRow[cfg.ritase]?.toString().trim() || "RIT 1") : "RIT 1";
  const shift = cfg.shift !== null ? (displayRow[cfg.shift]?.toString().trim() || "DAY SHIFT") : "DAY SHIFT";
  const cleanId = area + "-" + nopol + "-" + date + "-" + shift.replace(/\s+/g, '') + "-" + ritase.replace(/\s+/g, '');

  return {
    id: cleanId,
    driver_id: driverId,
    area: area,
    tanggal: date,
    no_polisi: nopol,
    shift: shift,
    ritase_no: ritase,
    actual_outpool: formatTime(displayRow[cfg.outpool]),
    pdc_muat: displayRow[cfg.pdc_muat]?.toString().trim() || "",
    plan_dccp: formatTime(displayRow[cfg.plan_dccp]),
    actual_in_pdc: formatTime(displayRow[cfg.in_pdc]),
    actual_out_pdc: formatTime(displayRow[cfg.out_pdc]),
    pdc_bongkar: cfg.pdc_bongkar !== null ? (displayRow[cfg.pdc_bongkar]?.toString().trim() || "") : "",
    plan_unloading: cfg.plan_unload !== null ? formatTime(displayRow[cfg.plan_unload]) : null,
    actual_unloading: formatTime(displayRow[cfg.actual_unload])
  };
}

function mapToLeadtimesTable(row, displayRow, headers, cfg, driverId) {
  try {
    const checkpoints = {};
    const statusInfo = {};
    let date = formatDateClean(row[cfg.tgl]);
    if (!date) return null; // row dengan tanggal tidak valid → skip

    const nopol = displayRow[cfg.nopol]?.toString().trim() || "UNKNOWN";
    const area = resolveMixedArea(nopol, cfg);
    const ritase = cfg.ritase !== null ? (displayRow[cfg.ritase]?.toString().trim() || "RIT 1") : "RIT 1";
    const shift = cfg.shift !== null ? (displayRow[cfg.shift]?.toString().trim() || "DAY") : "DAY";
    const driverName = displayRow[cfg.driver]?.toString().trim() || "";

    headers.forEach((h, i) => {
      if (!h || [cfg.tgl, cfg.driver, cfg.nopol].includes(i)) return;
      
      const head = h.toString().trim();
      const valStr = displayRow[i];
      
      if (valStr === "" || valStr === null || valStr === "-") return;

      if (head.match(/STATUS|EVALUASI|KONDISI|KETERANGAN|ABNORMALITY|REASON|DELAY|^DS$|^NS$/i)) {
        statusInfo[head] = valStr;
      } else {
        checkpoints[head] = formatTime(valStr) || valStr;
      }
    });

    return {
      tanggal: date,
      area: area,
      driver_id: driverId,
      driver: driverName,
      no_polisi: nopol,
      shift: shift,
      ritase_ke: ritase,
      checkpoints: checkpoints,
      status_info: statusInfo
    };
  } catch(e) { return null; }
}

function formatDateClean(date) {
  if (!date) return null;
  const tz = "GMT+7";
  
  // Kalau sudah objek Date → format langsung
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : Utilities.formatDate(date, tz, "yyyy-MM-dd");
  }
  
  const s = date.toString().trim();
  if (!s) return null;

  // Format "DD/MM/YYYY" atau "D/M/YYYY"
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yyyy = parseInt(m[3], 10);
    if (yyyy < 100) yyyy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return Utilities.formatDate(new Date(yyyy, mm - 1, dd), tz, "yyyy-MM-dd");
    }
    return null;
  }

  // Format "YYYY-MM-DD" atau "YYYY/MM/DD"
  m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) {
    const yyyy = parseInt(m[1], 10), mm = parseInt(m[2], 10), dd = parseInt(m[3], 10);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return Utilities.formatDate(new Date(yyyy, mm - 1, dd), tz, "yyyy-MM-dd");
    }
    return null;
  }

  // Fallback: biarkan Date() coba parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Utilities.formatDate(d, tz, "yyyy-MM-dd");
}

function formatTime(val) {
  if (!val || val === "-" || val.toString().trim() === "" || val.toString() === "0") return null;
  const tStr = val.toString().trim();
  
  const match = tStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    return hours + ':' + minutes;
  }
  return null;
}

function clearWebhookLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('KONFIRMASI', 'Hapus sheet WEBHOOK_LOG?', ui.ButtonSet.YES_NO) == ui.Button.YES) {
    const logSheet = ss.getSheetByName("WEBHOOK_LOG");
    if (logSheet) {
      ss.deleteSheet(logSheet);
      ui.alert('BERHASIL', 'WEBHOOK_LOG sudah dihapus!', ui.ButtonSet.OK);
    } else {
      ui.alert('INFO', 'WEBHOOK_LOG tidak ditemukan.', ui.ButtonSet.OK);
    }
  }
}
