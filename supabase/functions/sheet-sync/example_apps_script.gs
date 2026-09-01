// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — versi aman (tanpa service_role key)
//
// Ganti SUPABASE_KEY & SUPABASE_URL dengan:
//   WRITE_KEY  → string acak yang di-set di Supabase secrets (lihat README)
//   FUNCTION_URL → URL edge function sheet-sync setelah di-deploy
//
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY = '<ISI_DENGAN_WRITE_KEY>';

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
    .addItem('⚡ Sinkron LeadTime Luar Kota', 'syncLeadTimeLuarKota')
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
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 400) {
    throw new Error('Sync gagal (' + code + '): ' + body);
  }
  return JSON.parse(body);
}

// ─── 1. SINKRON KE TABLE: trips (delete per area, lalu insert ulang) ──────────
function uploadSemuaArea() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const driversMap = getAllDriversMap();
  let totalSuccess = 0;

  ss.getSheets().forEach(sheet => {
    const cfg = getColumnConfig(sheet.getName());
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
      // Hapus data area ini dulu, lalu insert ulang — sekarang lewat edge function
      callSync('trips', 'delete_then_insert', finalBatch, { area: cfg.area });
      totalSuccess += finalBatch.length;
    }
  });
  ss.toast("Selesai! " + totalSuccess + " Data Trips Sinkron.", "SUKSES");
}

// ─── 2. SINKRON KE TABLE: leadtimes (delete per area, lalu insert ulang) ──────
function uploadLeadtimeAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const driversMap = getAllDriversMap();
  let totalSuccess = 0;

  ss.getSheets().forEach(sheet => {
    const cfg = getColumnConfig(sheet.getName());
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
      callSync('leadtimes', 'delete_then_insert', finalBatch, { area: cfg.area });
      totalSuccess += finalBatch.length;
    }
  });
  ss.toast("Selesai! " + totalSuccess + " Data Leadtimes Sinkron.", "SUKSES");
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

function mapToTripsTable(row, displayRow, driverId, cfg) {
  let date = formatDateClean(row[cfg.tgl]);
  if (!date) return null;
  const nopol = displayRow[cfg.nopol]?.toString().trim() || "UNKNOWN";
  const ritase = cfg.ritase !== null ? (displayRow[cfg.ritase]?.toString().trim() || "RIT 1") : "RIT 1";
  const shift = cfg.shift !== null ? (displayRow[cfg.shift]?.toString().trim() || "DAY SHIFT") : "DAY SHIFT";
  const cleanId = cfg.area + "-" + nopol + "-" + date + "-" + shift.replace(/\s+/g, '') + "-" + ritase.replace(/\s+/g, '');

  return {
    id: cleanId,
    driver_id: driverId,
    area: cfg.area,
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
      area: cfg.area,
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

function sendBatch(batch, table) {
  // TIDAK DIPAKAI LAGI — batching sekarang di edge function (insertChunked).
  // Bisa dihapus, atau biarkan sebagai cadangan.
  throw new Error('sendBatch tidak dipakai lagi. Gunakan callSync().');
}

// ── syncLeadTimeLuarKota: delete per tanggal+area (filter IN), lalu insert ulang ──
function syncLeadTimeLuarKota() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();

  const SHEET_CONFIGS = [
    { name: 'Looker TAM PLB-PDG', area: 'PADANG' },
    { name: 'Looker Sulawesi', area: 'SULAWESI' },
    { name: 'Looker TAM Kalimantan', area: 'KALIMANTAN' }
  ];

  const payload = [];

  for (const config of SHEET_CONFIGS) {
    const sheet = ss.getSheetByName(config.name);
    if (!sheet) { Logger.log(`Sheet not found: ${config.name}`); continue; }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rawDate = row[0];
      if (!rawDate || !(rawDate instanceof Date) || isNaN(rawDate.getTime())) continue;

      const nopol = String(row[1] || '').trim().toUpperCase();
      const driver = String(row[2] || '').trim();
      const outPool = String(row[3] || '').trim();
      const reasonOutPool = String(row[4] || '').trim();
      const inPdc = String(row[5] || '').trim();
      const reasonPdc = String(row[6] || '').trim();
      const delivery = String(row[7] || '').trim();
      const reasonDelivery = String(row[8] || '').trim();
      const backToPool = String(row[9] || '').trim();
      const reasonBackToPool = String(row[10] || '').trim();

      payload.push({
        tanggal: Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd'),
        area: config.area,
        no_polisi: nopol,
        driver: driver,
        shift: 'DAY SHIFT',
        ritase_ke: 'RIT 1',
        status_info: {
          'Actual OutPool': outPool,
          'Reason Delay OutPool': reasonOutPool,
          'Actual InPDC': inPdc,
          'Reason Delay PDC': reasonPdc,
          'Actual Delivery': delivery,
          'Reason Delay Delivery': reasonDelivery,
          'Actual BackToPool': backToPool,
          'Reason Delay BackToPool': reasonBackToPool
        },
        checkpoints: {}
      });
    }
  }

  if (payload.length === 0) {
    SpreadsheetApp.getUi().alert('❌ 0 data valid. Cek format tanggal di kolom A.');
    return;
  }

  // Delete data lama per area + tanggal (pakai filter IN — didukung edge function)
  const uniqueAreas = [...new Set(payload.map(p => p.area))];
  const uniqueDates = [...new Set(payload.map(p => p.tanggal))];
  callSync('leadtimes', 'delete_then_insert', payload, {
    tanggal: uniqueDates,
    area: uniqueAreas
  });

  SpreadsheetApp.getUi().alert(
    `✅ Selesai Sinkron Luar Kota!\n• Total: ${payload.length} baris\n• Area: ${uniqueAreas.join(', ')}`
  );
}
