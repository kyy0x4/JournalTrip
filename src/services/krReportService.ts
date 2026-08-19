import { supabase } from '../lib/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface KRReportRow {
  id: string;
  tanggal: string;
  tanggal_date: string | null;
  nama_kr: string;
  area_loading: string | null;
  no_lambung: string | null;
  nama_driver: string | null;
  nama_asisten: string | null;
  waktu_in_pdc: string | null;
  waktu_loading: string | null;
  waktu_unloading: string | null;
  apd_driver: string | null;
  apd_asisten: string | null;
  temuan_ng_apd: string | null;
  dokumentasi_apd_ng: string | null;
  loading_position_1_driver: string | null;
  loading_position_1_asisten: string | null;
  temuan_ng_loading_position_1: string | null;
  loading_position_2_driver: string | null;
  loading_position_2_asisten: string | null;
  temuan_ng_loading_position_2: string | null;
  loading_position_3_driver: string | null;
  loading_position_3_asisten: string | null;
  temuan_ng_loading_position_3: string | null;
  loading_position_4_driver: string | null;
  loading_position_4_asisten: string | null;
  temuan_ng_loading_position_4: string | null;
  loading_position_5_driver: string | null;
  loading_position_5_asisten: string | null;
  temuan_ng_loading_position_5: string | null;
  loading_position_6_driver: string | null;
  loading_position_6_asisten: string | null;
  temuan_ng_loading_position_6: string | null;
  loading_position_7_driver: string | null;
  loading_position_7_asisten: string | null;
  temuan_ng_loading_position_7: string | null;
  dokumentasi_unit_ng: string | null;
  ada_kejadian_incident: string | null;
  kronologis_incident: string | null;
  created_at: string;
}

export interface KRSummaryRow {
  nama_kr: string;
  report_count: number;
  broken_sop: number;
  apd_ng: number;
  incident: number;
}

export interface KRDailyTrend {
  date: string; // YYYY-MM-DD
  report_count: number;
  broken_sop: number;
  apd_ng: number;
  incident: number;
}

// ─── HELPERS: deteksi NG ───────────────────────────────────────────────────────
function isNGValue(v: string | null | undefined): boolean {
  const val = (v || '').trim().toUpperCase();
  if (!val || val === 'T/A' || val === 'N/A' || val === '-') return false;
  return val.includes('NG');
}

function isFilled(v: string | null | undefined): boolean {
  const val = (v || '').trim().toUpperCase();
  return val !== '' && val !== 'T/A' && val !== 'N/A' && val !== '-';
}

function isIncident(v: string | null | undefined): boolean {
  const val = (v || '').trim().toUpperCase();
  if (!val || val === 'T/A' || val === 'N/A' || val === '-') return false;
  if (val.includes('TIDAK ADA') || val.includes('NO INCIDENT') || val === 'TIDAK') return false;
  return true;
}

const LOADING_POSITIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function countBrokenSOP(row: KRReportRow): number {
  let count = 0;
  for (const p of LOADING_POSITIONS) {
    const driver = (row as any)[`loading_position_${p}_driver`];
    const asisten = (row as any)[`loading_position_${p}_asisten`];
    const temuan = (row as any)[`temuan_ng_loading_position_${p}`];
    if (isNGValue(driver) || isNGValue(asisten) || isFilled(temuan)) count++;
  }
  return count;
}

export function countAPDNG(row: KRReportRow): number {
  const apdD = isNGValue(row.apd_driver);
  const apdA = isNGValue(row.apd_asisten);
  const temuan = isFilled(row.temuan_ng_apd);
  return apdD || apdA || temuan ? 1 : 0;
}

export function countIncident(row: KRReportRow): number {
  const kejadian = isIncident(row.ada_kejadian_incident);
  const kronologis = isFilled(row.kronologis_incident);
  return kejadian || kronologis ? 1 : 0;
}

// ─── PARSE TANGGAL (DD/MM/YYYY, DD-MM-YYYY, atau ISO) ─────────────────────────
export function parseKRDate(v: string | null | undefined): string | null {
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

// ─── FETCH ─────────────────────────────────────────────────────────────────────
export async function fetchKRReports(
  month: string, // 'YYYY-MM'
  options?: { area?: string }
): Promise<KRReportRow[]> {
  try {
    const [y, m] = month.split('-').map(Number);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    let query = supabase
      .from('kr_reports')
      .select('*')
      .gte('tanggal_date', startDate)
      .lte('tanggal_date', endDate);

    if (options?.area && options.area !== 'ALL') {
      query = query.eq('area_loading', options.area);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching kr_reports:', error);
      return [];
    }
    return (data || []) as KRReportRow[];
  } catch (e) {
    console.error('Unexpected error fetching kr_reports:', e);
    return [];
  }
}

// ─── AGREGASI ──────────────────────────────────────────────────────────────────
export function summarizeKR(rows: KRReportRow[]): KRSummaryRow[] {
  const map = new Map<string, KRSummaryRow>();
  for (const row of rows) {
    const key = (row.nama_kr || 'T/A').trim();
    if (!map.has(key)) {
      map.set(key, { nama_kr: key, report_count: 0, broken_sop: 0, apd_ng: 0, incident: 0 });
    }
    const item = map.get(key)!;
    item.report_count += 1;
    item.broken_sop += countBrokenSOP(row);
    item.apd_ng += countAPDNG(row);
    item.incident += countIncident(row);
  }
  return Array.from(map.values()).sort((a, b) => b.report_count - a.report_count);
}

export function buildDailyTrend(rows: KRReportRow[], month: string): KRDailyTrend[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const trend: KRDailyTrend[] = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return {
      date: `${y}-${String(m).padStart(2, '0')}-${d}`,
      report_count: 0,
      broken_sop: 0,
      apd_ng: 0,
      incident: 0,
    };
  });

  const byDate = new Map<string, KRReportRow[]>();
  for (const row of rows) {
    const d = parseKRDate(row.tanggal) || row.tanggal_date || '';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(row);
  }

  for (const [d, list] of byDate) {
    const t = trend.find(x => x.date === d);
    if (!t) continue;
    t.report_count = list.length;
    t.broken_sop = list.reduce((acc, r) => acc + countBrokenSOP(r), 0);
    t.apd_ng = list.reduce((acc, r) => acc + countAPDNG(r), 0);
    t.incident = list.reduce((acc, r) => acc + countIncident(r), 0);
  }

  return trend;
}