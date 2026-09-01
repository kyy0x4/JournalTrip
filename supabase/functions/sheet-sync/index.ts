// ═══════════════════════════════════════════════════════════════════════════════
// sheet-sync — Edge Function pengganti service_role untuk sinkronisasi
// Google Sheets → Supabase via Apps Script.
//
// Apps Script TIDAK perlu lagi menyimpan service_role key. Cukup:
//   POST https://<project-ref>.functions.supabase.co/sheet-sync
//   headers: { "Content-Type": "application/json", "x-write-key": "<WRITE_KEY>" }
//   body: {
//     "table": "kr_reports",
//     "operation": "delete_then_insert",   // insert | upsert | delete | delete_then_insert | replace_all
//     "rows": [ { ... } ],                  // untuk insert/upsert/delete_then_insert/replace_all
//     "match": { "tanggal_date": "2026-08-01" },  // untuk delete/delete_then_insert
//                                                // nilai bisa array → filter IN: { "tanggal": ["2026-08-01","2026-08-02"] }
//                                                // nilai bisa objek → filter range: { "tanggal_date": { "gte": "2026-01-01", "lte": "2026-12-31" } }
//     "onConflict": "tanggal_date"          // opsional, untuk upsert
//   }
//
// Env yang harus di-set di Supabase Dashboard → Edge Functions → sheet-sync → Secrets:
//   WRITE_KEY  : string acak panjang (contoh: openssl rand -hex 32)
//
// Allowlist tabel di bawah — tabel lain akan ditolak meski key benar.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';

const WRITE_KEY = Deno.env.get('WRITE_KEY') || '';

// Tabel yang boleh di-sync dari spreadsheet.
// Tambahkan tabel lain di sini kalau memang perlu diisi dari Apps Script.
const ALLOWED_TABLES = new Set([
  'kr_reports',
  'leadtimes',
  'tenko',
  'driver_training_monthly',
  'p2h',
  'trips',
]);

// Operasi yang diizinkan
const ALLOWED_OPS = new Set(['insert', 'upsert', 'delete', 'delete_then_insert', 'replace_all']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-write-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validasi method
  if (req.method !== 'POST') {
    return json({ error: 'Method tidak diizinkan. Gunakan POST.' }, 405, corsHeaders);
  }

  // Validasi WRITE_KEY (constant-time compare biar anti timing attack)
  const provided = req.headers.get('x-write-key') || '';
  if (!WRITE_KEY || !safeEqual(provided, WRITE_KEY)) {
    return json({ error: 'Unauthorized: x-write-key salah atau tidak di-set.' }, 401, corsHeaders);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body harus JSON valid.' }, 400, corsHeaders);
  }

  const { table, operation, rows, match, onConflict } = body || {};

  if (!table || !ALLOWED_TABLES.has(table)) {
    return json({ error: `Tabel "${table}" tidak diizinkan.`, allowed: [...ALLOWED_TABLES] }, 403, corsHeaders);
  }
  if (!operation || !ALLOWED_OPS.has(operation)) {
    return json({ error: `Operasi "${operation}" tidak diizinkan.`, allowed: [...ALLOWED_OPS] }, 400, corsHeaders);
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    switch (operation) {
      case 'insert': {
        if (!Array.isArray(rows) || rows.length === 0) {
          return json({ error: 'rows wajib array non-kosong untuk insert.' }, 400, corsHeaders);
        }
        const total = await insertChunked(serviceClient, table, rows);
        return json({ ok: true, count: total }, 200, corsHeaders);
      }

      case 'upsert': {
        if (!Array.isArray(rows) || rows.length === 0) {
          return json({ error: 'rows wajib array non-kosong untuk upsert.' }, 400, corsHeaders);
        }
        // supabase-js v2: onConflict dikirim sebagai options, bukan method chaining
        const { data, error } = await serviceClient
          .from(table)
          .upsert(rows, { onConflict: onConflict || undefined })
          .select();
        if (error) throw error;
        return json({ ok: true, count: data?.length ?? 0 }, 200, corsHeaders);
      }

      case 'delete': {
        if (!match || typeof match !== 'object') {
          return json({ error: 'match wajib objek filter untuk delete.' }, 400, corsHeaders);
        }
        let q = serviceClient.from(table).delete();
        applyMatch(q, match);
        const { error } = await q;
        if (error) throw error;
        return json({ ok: true }, 200, corsHeaders);
      }

      case 'delete_then_insert': {
        // Pola sync spreadsheet: hapus dulu data lama (filter eq/IN/range), lalu insert ulang
        if (!match || typeof match !== 'object') {
          return json({ error: 'match wajib objek filter untuk delete_then_insert.' }, 400, corsHeaders);
        }
        if (!Array.isArray(rows) || rows.length === 0) {
          return json({ error: 'rows wajib array non-kosong untuk delete_then_insert.' }, 400, corsHeaders);
        }
        let del = serviceClient.from(table).delete();
        applyMatch(del, match);
        const { error: delErr } = await del;
        if (delErr) throw delErr;

        const total = await insertChunked(serviceClient, table, rows);
        return json({ ok: true, deleted: true, count: total }, 200, corsHeaders);
      }

      case 'replace_all': {
        // Pola "send data" Apps Script: hapus SEMUA baris di tabel,
        // lalu insert ulang dengan data terbaru dari spreadsheet.
        if (!Array.isArray(rows) || rows.length === 0) {
          return json({ error: 'rows wajib array non-kosong untuk replace_all.' }, 400, corsHeaders);
        }

        const { error: delAllErr } = await serviceClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (delAllErr) throw delAllErr;

        const total = await insertChunked(serviceClient, table, rows);
        return json({ ok: true, deletedAll: true, count: total }, 200, corsHeaders);
      }
    }
  } catch (e: any) {
    console.error('sheet-sync error:', e?.message || e);
    return json({ error: e?.message || 'Terjadi kesalahan.' }, 500, corsHeaders);
  }
});

// ── Insert dengan batching + paralel (biar sync ribuan baris cepet) ────────────
const INSERT_CHUNK = 500;
const MAX_CONCURRENCY = 4; // batasi request paralel biar nggak overload DB

async function insertChunked(client: any, table: string, rows: any[]): Promise<number> {
  const chunks: any[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    chunks.push(rows.slice(i, i + INSERT_CHUNK));
  }

  let inserted = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const { error } = await client.from(table).insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, chunks.length) }, () => worker()));
  return inserted;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// Terapkan filter match ke query. Nilai bisa:
//   string → eq      { "area": "JBK" }
//   array  → in      { "tanggal": ["2026-08-01","2026-08-02"] }
//   objek  → range   { "tanggal_date": { "gte": "2026-01-01", "lte": "2026-12-31" } }
function applyMatch(q: any, match: Record<string, any>) {
  for (const [col, val] of Object.entries(match)) {
    if (Array.isArray(val)) {
      q = q.in(col, val as string[]);
    } else if (val && typeof val === 'object') {
      for (const [op, v] of Object.entries(val)) {
        if (op === 'gte') q = q.gte(col, v as string);
        else if (op === 'lte') q = q.lte(col, v as string);
        else if (op === 'gt') q = q.gt(col, v as string);
        else if (op === 'lt') q = q.lt(col, v as string);
        else if (op === 'neq') q = q.neq(col, v as string);
        else q = q.eq(col, v as string);
      }
    } else {
      q = q.eq(col, val as string);
    }
  }
}

// Constant-time string comparison (anti timing attack)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
