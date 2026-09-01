// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — SYNC TENKO (khusus Tenko, tanpa service_role key)
//
// CARA PAKAI:
//   1. Copy SELURUH isi file ini ke project Apps Script sheet Tenko (replace semua)
//   2. Isi WRITE_KEY sesuai yang di-set di Supabase secrets
//   3. Save → tutup & buka ulang spreadsheet → menu "🚀 SYNC DASHBOARD" muncul
//
// CATATAN: file ini khusus Tenko. Jangan dicampur dengan script trips/leadtime —
// tiap script punya callSync-nya sendiri.
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY = '<ISI_DENGAN_WRITE_KEY>';
const CALLSYNC_BATCH = 2000; // pecah batch > 2000 baris biar sync cepet

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
    timeout: 290, // maksimum UrlFetchApp (detik)
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
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 SYNC DASHBOARD')
      .addItem('Sync Data Tenko All Area', 'syncTenkoFinal')
      .addToUi();
}

// ── Sync Tenko All Area ─────────────────────────────────────────────────────────
function syncTenkoFinal() {
  const FILE_CONFIGS = [
    { 
      area: 'KARAWANG',
      id: '1Y3DFhOSzJ68y8RfKEmRhLRYjYELZsfTILr582Rpho70', 
      sheetName: 'Tenko',
      mapping: {
        tanggal: 0, driver: 1, nik: 2, nopol: 3, lambung: 4, tensi_str: 5, nadi: 6, suhu: 7, alkohol: 8, mata: 9, fatigue: 10, tim_tenko: 12, trcc: 13, customer: 14, rute: 15, jam_cek: 16, coaching: 17,
        mental: 18, gps: 19, oxygen: 20, rest: 21, sis: 23, dia: 24, umur: 25
      }
    },
    { 
      area: 'BEKASI',
      id: '1dSbMn_qroFmg-H2RUPBzajlbyjwcnmhbpEQA77LpbnY', 
      sheetName: 'Form Responses 1', 
      mapping: {
        tanggal: 0, driver: 1, nik: 2, nopol: 3, lambung: 4, tensi_str: 5, nadi: 6, suhu: 7, alkohol: 8, mata: 9, fatigue: 10, tim_tenko: 12, trcc: 13, customer: 14, rute: 15, jam_cek: 16, coaching: 17,
        gps: 18, sis: 19, dia: 20, umur: 21
      }
    }
  ];

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  let payload = [];
  let seen = new Set(); // Cegah duplikat baris yang sama persis
  
  FILE_CONFIGS.forEach(config => {
    try {
      const ss = SpreadsheetApp.openById(config.id.trim());
      const sheet = ss.getSheetByName(config.sheetName);
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const m = config.mapping;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; 

        let d = row[0];
        if (!(d instanceof Date)) {
          let str = String(row[0]).split(',').pop().trim();
          d = new Date(str);
        }
        if (isNaN(d.getTime())) d = new Date(); 
        
        const ts = Utilities.formatDate(d, "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");
        const tgl = Utilities.formatDate(row[m.tanggal] instanceof Date ? row[m.tanggal] : d, tz, 'yyyy-MM-dd');
        const jamCek = row[m.jam_cek] instanceof Date ? Utilities.formatDate(row[m.jam_cek], tz, "HH:mm") : String(row[m.jam_cek] || "");

        const sis = parseInt(row[m.sis]) || (parseInt(String(row[m.tensi_str]).split('/')[0]) || 0);
        const dia = parseInt(row[m.dia]) || (parseInt(String(row[m.tensi_str]).split('/')[1]) || 0);
        
        // Validasi: kalau tensi nggak ada (0/0), skip baris — jangan diisi default.
        // Data Tenko yang nggak lengkap misleading (di gatepass bakal dianggap sehat).
        if (!sis || !dia) continue;

        // Logika Duplikat: Tanggal + Nama + Sis + Dia sama persis → skip
        const duplicateKey = `${tgl}-${row[m.driver]}-${sis}-${dia}`;
        if (seen.has(duplicateKey)) continue;
        seen.add(duplicateKey);

        const nikVal = String(row[m.nik] || "").trim();
        const namaVal = String(row[m.driver] || "").toUpperCase();
        const isAsst = nikVal.toUpperCase().includes("ASST") || namaVal.includes("ASST");

        const alkRaw = row[m.alkohol];
        const isNegatif = parseFloat(alkRaw) === 0 || String(alkRaw).includes("0") || String(alkRaw).toLowerCase().includes("baik");

        payload.push({
          tanggal: tgl, 
          timestamp: ts, 
          nik: nikVal,
          nama_driver: namaVal,
          nopol: String(row[m.nopol] || "").toUpperCase(),
          no_lambung: String(row[m.lambung] || "").toUpperCase(),
          tensi: `${sis}/${dia}`,
          sistolik: sis,
          diastolik: dia,
          denyut_nadi: parseInt(row[m.nadi]) || 80,
          suhu_tubuh: parseFloat(row[m.suhu]) || 36.5,
          alkohol: isNegatif ? 0 : 1,
          mata: String(row[m.mata] || "OK"),
          fatigue: String(row[m.fatigue] || "NORMAL"),
          tim_tenko: String(row[m.tim_tenko] || ""),
          trcc: String(row[m.trcc] || ""),
          customer: String(row[m.customer] || "UMUM").toUpperCase(),
          rute_tujuan: String(row[m.rute] || ""),
          jam_cek_rm: jamCek, 
          hasil_coaching: String(row[m.coaching] || ""),
          mental_check: m.mental ? String(row[m.mental] || "") : null,
          status_gps: String(row[m.gps] || ""),
          oxygen_saturation: m.oxygen ? (parseInt(row[m.oxygen]) || 98) : 98,
          rest_time: m.rest ? (parseInt(row[m.rest]) || 8) : 8,
          umur: m.umur ? (parseInt(row[m.umur]) || 0) : 0,
          is_assistant: isAsst,
          area: config.area
        });
      }
    } catch (e) { 
      Logger.log("GAGAL AKSES " + config.area + ": " + e.message); 
    }
  });

  if (payload.length > 0) {
    const uniqueAreas = [...new Set(payload.map(p => p.area))];
    const uniqueDates = [...new Set(payload.map(p => p.tanggal))];
    
    // Hapus data lama per tanggal+area, lalu insert ulang — lewat edge function.
    // callSyncBatched otomatis pecah kalau datanya > 2000 baris (biar cepet).
    callSyncBatched('tenko', 'delete_then_insert', payload, {
      tanggal: uniqueDates,
      area: uniqueAreas
    });

    SpreadsheetApp.getUi().alert(`✅ SYNC BERHASIL!\nTotal ${payload.length} data masuk. Filter Assistant & NIK aman.`);
  } else {
    SpreadsheetApp.getUi().alert(`❌ ERROR: Ga ada data yang kekirim.`);
  }
}
