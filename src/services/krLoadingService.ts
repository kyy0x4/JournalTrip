import { supabase } from '../lib/supabase';

export interface KRLoadingRow {
  id: string;
  entry_timestamp: string | null;
  nama_kr: string;
  pdc_muat: string | null;
  tanggal_muat: string;
  tanggal_muat_date: string | null;
  jam_muat: string | null;
  no_lambung: string | null;
  nama_driver: string | null;
  total_muat: number | null;
  no_rangka_1: string | null;
  no_rangka_2: string | null;
  no_rangka_3: string | null;
  no_rangka_4: string | null;
  no_rangka_5: string | null;
  no_rangka_6: string | null;
  tujuan_pengiriman: string | null;
  created_at: string;
}

export interface KRLoadingSummaryByKR {
  nama_kr: string;
  loading_count: number;
  total_muat: number;
  avg_muat: number;
  lambung_count: number;
}

export interface KRLoadingDailyTrend {
  date: string;
  loading_count: number;
  total_muat: number;
}

export interface KRTujuanSummary {
  tujuan: string;
  loading_count: number;
  total_muat: number;
}

export interface KRMuatDistribution {
  muat: number;
  count: number;
}

export interface KRComparisonRow {
  nama_kr: string;
  monitoring_count: number;
  monitoring_units: number;
  checksheet_count: number;
  gap: number;
  gapAbs: number;
}

export function parseKRLoadingDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!dmy) return null;
  let yyyy = dmy[3];
  if (yyyy.length === 2) yyyy = '20' + yyyy;
  return `${yyyy}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
}

function isFilled(v: string | null | undefined): boolean {
  const s = (v || '').trim().toUpperCase();
  return s !== '' && s !== 'T/A' && s !== 'N/A' && s !== '-';
}

export function countRangkaFilled(row: KRLoadingRow): number {
  let n = 0;
  for (let i = 1; i <= 6; i++) {
    const v = (row as any)[`no_rangka_${i}`];
    if (isFilled(v)) n++;
  }
  return n;
}

function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]!; }
function genRangka(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let s = 'MHKA';
  for (let i = 0; i < 13; i++) s += chars[randInt(0, chars.length - 1)];
  return s;
}

const DUMMY_KR = ['BUDI SANTOSO', 'AGUS WIBOWO', 'JOKO SUSILO', 'HERU PRANOTO', 'SLAMET RIYADI'];
const DUMMY_PDC = ['PDC KARAWANG', 'PDC BEKASI', 'PDC CIKARANG', 'PDC CIBITUNG'];
const DUMMY_TUJUAN = ['JAKARTA', 'BANDUNG', 'SURABAYA', 'SEMARANG', 'PALEMBANG', 'LAMPUNG', 'PEKANBARU'];
const DUMMY_DRIVER = ['SUPRIYANTO', 'JUNAEDI', 'WAHYU HIDAYAT', 'ASEP KURNIAWAN', 'DEDI SAPUTRA', 'RIZKI ANANDA', 'FAJAR NUGROHO', 'BAMBANG S'];
const DUMMY_LAMBUNG = ['B 9234 UIA', 'B 9123 UIB', 'B 9456 UIC', 'B 9321 UID', 'B 9188 UIE', 'B 9567 UIF', 'B 9345 UIG', 'B 9211 UIH'];

export function generateDummyKRLoadingRows(month: string): KRLoadingRow[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const count = 26;
  const rows: KRLoadingRow[] = [];
  for (let i = 0; i < count; i++) {
    const day = randInt(1, Math.min(daysInMonth, 26));
    const dd = String(day).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const tanggal_muat = `${dd}/${mm}/${y}`;
    const tanggal_muat_date = `${y}-${mm}-${dd}`;
    const jam = `${String(randInt(6, 19)).padStart(2, '0')}:${String(pick([0, 15, 30, 45])).padStart(2, '0')}`;
    const total_muat = randInt(2, 6);
    const nama_kr = pick(DUMMY_KR);
    const pdc_muat = pick(DUMMY_PDC);
    const no_lambung = pick(DUMMY_LAMBUNG);
    const nama_driver = pick(DUMMY_DRIVER);
    const tujuan_pengiriman = pick(DUMMY_TUJUAN);
    const rangkas: (string | null)[] = Array.from({ length: 6 }, (_, idx) => (idx < total_muat ? genRangka() : null));
    const hh = String(randInt(0, 23)).padStart(2, '0');
    const mi = String(randInt(0, 59)).padStart(2, '0');
    const entry_timestamp = new Date(`${tanggal_muat_date}T${hh}:${mi}:00+07:00`).toISOString();
    rows.push({
      id: `dummy-${y}${mm}${dd}-${i}`,
      entry_timestamp,
      nama_kr,
      pdc_muat,
      tanggal_muat,
      tanggal_muat_date,
      jam_muat: jam,
      no_lambung,
      nama_driver,
      total_muat,
      no_rangka_1: rangkas[0],
      no_rangka_2: rangkas[1],
      no_rangka_3: rangkas[2],
      no_rangka_4: rangkas[3],
      no_rangka_5: rangkas[4],
      no_rangka_6: rangkas[5],
      tujuan_pengiriman,
      created_at: entry_timestamp,
    });
  }
  rows.sort((a, b) => (a.tanggal_muat_date || '').localeCompare(b.tanggal_muat_date || '') || String(a.jam_muat).localeCompare(String(b.jam_muat)));
  return rows;
}

export function isDummyRow(row: KRLoadingRow): boolean {
  return row.id.startsWith('dummy-');
}

export async function fetchKRLoadingUnits(
  month: string,
  options?: { pdc?: string; tujuan?: string; nama_kr?: string }
): Promise<KRLoadingRow[]> {
  try {
    const [y, m] = month.split('-').map(Number);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    let query = supabase
      .from('kr_loading_units')
      .select('*')
      .gte('tanggal_muat_date', startDate)
      .lte('tanggal_muat_date', endDate);

    if (options?.pdc && options.pdc !== 'ALL') {
      query = query.eq('pdc_muat', options.pdc);
    }
    if (options?.tujuan && options.tujuan !== 'ALL') {
      query = query.eq('tujuan_pengiriman', options.tujuan);
    }
    if (options?.nama_kr && options.nama_kr !== 'ALL') {
      query = query.eq('nama_kr', options.nama_kr);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data as KRLoadingRow[];
    }
    if (error) console.warn('kr_loading_units fetch fallback to dummy:', error.message);
    const dummy = generateDummyKRLoadingRows(month);
    let filtered = dummy;
    if (options?.pdc && options.pdc !== 'ALL') filtered = filtered.filter(r => r.pdc_muat === options.pdc);
    if (options?.tujuan && options.tujuan !== 'ALL') filtered = filtered.filter(r => r.tujuan_pengiriman === options.tujuan);
    if (options?.nama_kr && options.nama_kr !== 'ALL') filtered = filtered.filter(r => r.nama_kr === options.nama_kr);
    return filtered;
  } catch (e) {
    console.error('Unexpected error fetching kr_loading_units:', e);
    const dummy = generateDummyKRLoadingRows(month);
    let filtered = dummy;
    if (options?.pdc && options.pdc !== 'ALL') filtered = filtered.filter(r => r.pdc_muat === options.pdc);
    if (options?.tujuan && options.tujuan !== 'ALL') filtered = filtered.filter(r => r.tujuan_pengiriman === options.tujuan);
    if (options?.nama_kr && options.nama_kr !== 'ALL') filtered = filtered.filter(r => r.nama_kr === options.nama_kr);
    return filtered;
  }
}

export function summarizeByKR(rows: KRLoadingRow[]): KRLoadingSummaryByKR[] {
  const map = new Map<string, { loading_count: number; total_muat: number; lambungs: Set<string> }>();
  for (const r of rows) {
    const key = (r.nama_kr || 'T/A').trim();
    if (!map.has(key)) map.set(key, { loading_count: 0, total_muat: 0, lambungs: new Set() });
    const item = map.get(key)!;
    item.loading_count += 1;
    item.total_muat += Number(r.total_muat || 0);
    if (r.no_lambung) item.lambungs.add(r.no_lambung.trim());
  }
  return Array.from(map.entries())
    .map(([nama_kr, v]) => ({
      nama_kr,
      loading_count: v.loading_count,
      total_muat: v.total_muat,
      avg_muat: v.loading_count ? Math.round((v.total_muat / v.loading_count) * 10) / 10 : 0,
      lambung_count: v.lambungs.size,
    }))
    .sort((a, b) => b.total_muat - a.total_muat);
}

export function summarizeByTujuan(rows: KRLoadingRow[]): KRTujuanSummary[] {
  const map = new Map<string, { loading_count: number; total_muat: number }>();
  for (const r of rows) {
    const key = (r.tujuan_pengiriman || 'T/A').trim().toUpperCase();
    if (!map.has(key)) map.set(key, { loading_count: 0, total_muat: 0 });
    const item = map.get(key)!;
    item.loading_count += 1;
    item.total_muat += Number(r.total_muat || 0);
  }
  return Array.from(map.entries())
    .map(([tujuan, v]) => ({ tujuan, loading_count: v.loading_count, total_muat: v.total_muat }))
    .sort((a, b) => b.total_muat - a.total_muat);
}

export function buildMuatDistribution(rows: KRLoadingRow[]): KRMuatDistribution[] {
  const map = new Map<number, number>();
  for (const r of rows) {
    const n = Number(r.total_muat || 0);
    if (n <= 0) continue;
    map.set(n, (map.get(n) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([muat, count]) => ({ muat, count }))
    .sort((a, b) => a.muat - b.muat);
}

export function buildKRComparison(
  monitoringRows: KRLoadingRow[],
  checksheetRows: { nama_kr: string }[],
): KRComparisonRow[] {
  const monMap = new Map<string, { count: number; units: number }>();
  for (const r of monitoringRows) {
    const k = (r.nama_kr || 'T/A').trim();
    if (!monMap.has(k)) monMap.set(k, { count: 0, units: 0 });
    const v = monMap.get(k)!;
    v.count += 1;
    v.units += Number(r.total_muat || 0);
  }
  const chkMap = new Map<string, number>();
  for (const r of checksheetRows) {
    const k = (r.nama_kr || 'T/A').trim();
    chkMap.set(k, (chkMap.get(k) || 0) + 1);
  }
  const allKrs = new Set<string>([...monMap.keys(), ...chkMap.keys()]);
  const out: KRComparisonRow[] = [];
  for (const k of allKrs) {
    const m = monMap.get(k);
    const c = chkMap.get(k) || 0;
    const mc = m?.count || 0;
    const gap = mc - c;
    out.push({
      nama_kr: k,
      monitoring_count: mc,
      monitoring_units: m?.units || 0,
      checksheet_count: c,
      gap,
      gapAbs: Math.abs(gap),
    });
  }
  return out.sort((a, b) => b.gapAbs - a.gapAbs);
}

export function filterByDateRange(rows: KRLoadingRow[], start: string | null, end: string | null): KRLoadingRow[] {
  if (!start && !end) return rows;
  return rows.filter(r => {
    const d = parseKRLoadingDate(r.tanggal_muat) || r.tanggal_muat_date || '';
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

export function buildDailyTrend(rows: KRLoadingRow[], month: string): KRLoadingDailyTrend[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const trend: KRLoadingDailyTrend[] = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { date: `${y}-${String(m).padStart(2, '0')}-${d}`, loading_count: 0, total_muat: 0 };
  });

  const byDate = new Map<string, KRLoadingRow[]>();
  for (const row of rows) {
    const d = parseKRLoadingDate(row.tanggal_muat) || row.tanggal_muat_date || '';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(row);
  }

  for (const [d, list] of byDate) {
    const t = trend.find(x => x.date === d);
    if (!t) continue;
    t.loading_count = list.length;
    t.total_muat = list.reduce((acc, r) => acc + Number(r.total_muat || 0), 0);
  }

  return trend;
}

export function buildDailyTrendFromDateRange(rows: KRLoadingRow[], start: string, end: string): KRLoadingDailyTrend[] {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const days: KRLoadingDailyTrend[] = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: iso, loading_count: 0, total_muat: 0 });
  }
  const byDate = new Map<string, KRLoadingRow[]>();
  for (const row of rows) {
    const d = parseKRLoadingDate(row.tanggal_muat) || row.tanggal_muat_date || '';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(row);
  }
  for (const t of days) {
    const list = byDate.get(t.date);
    if (!list) continue;
    t.loading_count = list.length;
    t.total_muat = list.reduce((acc, r) => acc + Number(r.total_muat || 0), 0);
  }
  return days;
}
