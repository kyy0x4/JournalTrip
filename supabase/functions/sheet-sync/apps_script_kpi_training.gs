// ═══════════════════════════════════════════════════════════════════════════════
// APPS SCRIPT — SYNC KPI TRAINING (khusus driver_training_monthly)
//
// CARA PAKAI:
//   1. Copy SELURUH isi file ini ke project Apps Script sheet Training (replace semua)
//   2. Isi WRITE_KEY sesuai yang di-set di Supabase secrets
//   3. Save → tutup & buka ulang spreadsheet → menu "🚀 Sync Supabase" muncul
//
// CATATAN:
//   - Pola sync: UPSERT (on_conflict nik,bulan) — bukan delete-then-insert.
//   - Sebelumnya pakai anon key → setelah RLS aktif, write anon ditolak.
//     Versi ini lewat edge function (service_role server-side), jadi aman & jalan.
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = 'https://tdtywoejybnunxyqzmst.functions.supabase.co/sheet-sync';
const WRITE_KEY = '<ISI_DENGAN_WRITE_KEY>';

// ── Menu ────────────────────────────────────────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Sync Supabase')
    .addItem('Kirim Data Training', 'syncTrainingToSupabase')
    .addToUi();
}

// ── Kirim operasi ke edge function ─────────────────────────────────────────────
function callSync(table, operation, rows, match, onConflict) {
  const payload = { table, operation };
  if (rows) payload.rows = rows;
  if (match) payload.match = match;
  if (onConflict) payload.onConflict = onConflict;

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

// ── Sync Training → Supabase ────────────────────────────────────────────────────
function syncTrainingToSupabase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const nikIndex = headers.findIndex(h => h.toString().toUpperCase().trim() === 'NIK');
  if (nikIndex === -1) {
    SpreadsheetApp.getUi().alert("Error: Kolom NIK tidak ditemukan!");
    return;
  }
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  // Map buat cegah duplikasi data di dalam batch
  let payloadMap = {};
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let nik = row[nikIndex];
    if (!nik || nik.toString().trim() === "") continue;
    let cleanNik = nik.toString().trim();
    months.forEach(month => {
      let w1Idx = headers.findIndex(h => h === `${month}_W1`);
      let w2Idx = headers.findIndex(h => h === `${month}_W2`);
      let w3Idx = headers.findIndex(h => h === `${month}_W3`);
      let w4Idx = headers.findIndex(h => h === `${month}_W4`);
      
      let kehadiranIdx = headers.findIndex(h => h === `${month}_KEHADIRAN`);
      let aktualIdx = headers.findIndex(h => h === `${month}_ACTUAL_TRAINING`);
      let postTestIdx = headers.findIndex(h => h === `${month}_POST_TEST`);
      let kelulusanIdx = headers.findIndex(h => h === `${month}_KELULUSAN`);
      let kpiIdx = headers.findIndex(h => h === `${month}_SCORE_KPI`);

      // ── Format baru (Sep 2026+): per minggu ada HASIL_PRE_TEST / HASIL_POST_TEST / KETERANGAN_TEST ──
      // Ambil nilai pre/post test (gabung dari semua minggu yang ada)
      let preTestVals = [], postTestVals = [], keteranganVals = [];
      [1, 2, 3, 4].forEach(w => {
        const wIdx = headers.findIndex(h => h === `${month}_W${w}`);
        if (wIdx === -1) return;
        const pre = headers[wIdx + 1] === 'HASIL_PRE_TEST' ? row[wIdx + 1] : null;
        const post = headers[wIdx + 2] === 'HASIL_POST_TEST' ? row[wIdx + 2] : null;
        const ket = headers[wIdx + 3] === 'KETERANGAN_TEST' ? row[wIdx + 3] : null;
        if (pre !== null && pre !== '' && pre !== undefined) preTestVals.push(String(pre));
        if (post !== null && post !== '' && post !== undefined) postTestVals.push(String(post));
        if (ket !== null && ket !== '' && ket !== undefined) keteranganVals.push(String(ket));
      });

      // TOTAL_NILAI & Q3_KEHADIRAN (kolom baru, cuma ada di format baru)
      const totalNilaiIdx = headers.findIndex(h => h === 'TOTAL_NILAI');
      const qHadirIdx = headers.findIndex(h => h === 'Q3_KEHADIRAN');

      let kehadiran = kehadiranIdx > -1 ? row[kehadiranIdx] : 0;
      let postTest = postTestIdx > -1 ? row[postTestIdx] : 0;
      
      if (kehadiran !== "" && kehadiran !== undefined) {
        let tanggalArray = [];
        if (w1Idx > -1 && row[w1Idx]) tanggalArray.push(formatDate(row[w1Idx]));
        if (w2Idx > -1 && row[w2Idx]) tanggalArray.push(formatDate(row[w2Idx]));
        if (w3Idx > -1 && row[w3Idx]) tanggalArray.push(formatDate(row[w3Idx]));
        if (w4Idx > -1 && row[w4Idx]) tanggalArray.push(formatDate(row[w4Idx]));
        
        if (Number(kehadiran) > 0 || tanggalArray.length > 0 || Number(postTest) > 0 || preTestVals.length > 0 || postTestVals.length > 0) {
          
          // Kunci unik: "AR1475_JAN"
          let uniqueKey = `${cleanNik}_${month}`;
          
          // Kalau ada duplikat di Excel, data paling bawah (terakhir dibaca) yang dipakai
          payloadMap[uniqueKey] = {
            nik: cleanNik,
            bulan: month,
            tanggal_training: tanggalArray.join(", "),
            kehadiran: Number(kehadiran) || 0,
            aktual_training: aktualIdx > -1 ? (Number(row[aktualIdx]) || 0) : 0,
            post_test: Number(postTest) || 0,
            kelulusan: kelulusanIdx > -1 ? row[kelulusanIdx].toString() : null,
            score_kpi: kpiIdx > -1 ? (Number(row[kpiIdx]) || 0) : 0,
            // Kolom baru (format Sep 2026+)
            hasil_pre_test: preTestVals.join(", ") || null,
            hasil_post_test: postTestVals.join(", ") || null,
            keterangan_test: keteranganVals.join(", ") || null,
            total_nilai: totalNilaiIdx > -1 ? (Number(row[totalNilaiIdx]) || 0) : null,
            q_kehadiran: qHadirIdx > -1 ? (Number(row[qHadirIdx]) || 0) : null
          };
        }
      }
    });
  }
  
  let payloadBatch = Object.values(payloadMap);
  if (payloadBatch.length === 0) {
    SpreadsheetApp.getUi().alert("Tidak ada data training valid yang ditemukan.");
    return;
  }

  try {
    // Upsert lewat edge function — onConflict nik,bulan (sama kayak on_conflict dulu)
    const result = callSync('driver_training_monthly', 'upsert', payloadBatch, null, 'nik,bulan');
    SpreadsheetApp.getUi().alert(`✅ Berhasil! ${result.count} record unik data training tersimpan ke Supabase.`);
  } catch (error) {
    SpreadsheetApp.getUi().alert("Terjadi kesalahan:\n" + error.toString());
  }
}

// ── Helper ──────────────────────────────────────────────────────────────────────
function formatDate(dateValue) {
  if (!dateValue) return "";
  if (dateValue instanceof Date) {
    let d = dateValue.getDate().toString().padStart(2, '0');
    let m = (dateValue.getMonth() + 1).toString().padStart(2, '0');
    let y = dateValue.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return dateValue.toString();
}
