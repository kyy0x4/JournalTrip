import { supabase } from '../lib/supabase';

export interface TenkoRecord {
  id: string;
  tanggal: string;
  timestamp: string;
  driver_id: string;
  nama_driver: string; // Ambil langsung dari tabel tenko
  nopol: string;
  no_lambung: string;
  tensi: string;
  sistolik: number;
  diastolik: number;
  denyut_nadi: number;
  suhu_tubuh: number;
  alkohol: number;
  mata: string;
  fatigue: string;
  oxygen_saturation: number;
  rest_time: number;
  customer: string;
  area: string;
  nik: string;
  is_assistant: boolean;
  tim_tenko?: string;
  checked_by?: string;
  tensi_faktor?: string | null;
  tensi_keterangan?: string | null;
}

export const TENSI_FAKTOR_OPTIONS = [
  'Kurang Istirahat',
  'Stress / Tekanan Kerja',
  'Lupa Minum Obat',
  'Sakit / Demam',
  'Konsumsi Kafein Berlebih',
  'Kondisi Kronis / Genetik',
  'Belum Diketahui',
  'Lainnya',
] as const;

export type TensiFaktor = (typeof TENSI_FAKTOR_OPTIONS)[number];

export function isHipertensi(sistolik: number, diastolik: number) {
  return sistolik >= 145 || diastolik >= 90;
}

export function isHipotensi(sistolik: number, diastolik: number) {
  return sistolik < 90 || diastolik < 60;
}

export function isAbnormalTensi(sistolik: number, diastolik: number) {
  return isHipertensi(sistolik, diastolik) || isHipotensi(sistolik, diastolik);
}

export function getHipertensiTypeLabel(sistolik: number, diastolik: number): string {
  const sysHigh = sistolik >= 140;
  const diaHigh = diastolik >= 90;
  if (sysHigh && diaHigh) return 'Sistolik & Diastolik Tinggi';
  if (sysHigh) return 'Sistolik Tinggi';
  if (diaHigh) return 'Diastolik Tinggi';
  return 'Hipertensi';
}

export function formatTensiFaktorDisplay(record: Pick<TenkoRecord, 'tensi_faktor' | 'tensi_keterangan'>) {
  if (!record.tensi_faktor) return null;
  if (record.tensi_faktor === 'Lainnya' && record.tensi_keterangan?.trim()) {
    return record.tensi_keterangan.trim();
  }
  if (record.tensi_keterangan?.trim()) {
    return `${record.tensi_faktor} — ${record.tensi_keterangan.trim()}`;
  }
  return record.tensi_faktor;
}

export interface TenkoSummary {
  totalCheckups: number;
  tensi: {
    normal: number;
    hipertensi: number;
    hipotensi: number;
  };
  suhu: {
    normal: number;
    demam: number;
  };
  alkohol: {
    negatif: number;
    positif: number;
  };
  fatigue: {
    normal: number;
    lelah: number;
  };
  rest: {
    cukup: number;
    kurang: number;
  };
  nadi: {
    normal: number;
    abnormal: number;
  };
  mental: {
    ok: number;
    ng: number;
  };
  raw: TenkoRecord[];
}

export type TenkoMetricId = 'tensi' | 'suhu' | 'rest' | 'nadi' | 'alkohol' | 'fatigue' | 'mental';

export type MetricCategoryDef = {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  pieFilterName?: string;
};

export type TenkoMetricConfig = {
  id: TenkoMetricId;
  title: string;
  pieTitle: string;
  classify: (r: TenkoRecord) => string;
  categories: MetricCategoryDef[];
};

export function classifyTensiRecord(r: TenkoRecord) {
  return classifyTensiStatus(r.sistolik, r.diastolik);
}

export function classifySuhuRecord(r: TenkoRecord) {
  return r.suhu_tubuh >= 37.5 ? 'demam' : 'normal';
}

export function classifyRestRecord(r: TenkoRecord) {
  return Number(r.rest_time) >= 6 ? 'cukup' : 'kurang';
}

export function classifyNadiRecord(r: TenkoRecord) {
  const n = Number(r.denyut_nadi) || 0;
  return n >= 60 && n <= 100 ? 'normal' : 'abnormal';
}

export function classifyAlkoholRecord(r: TenkoRecord) {
  return Number(r.alkohol) === 0 ? 'negatif' : 'positif';
}

export function classifyFatigueRecord(r: TenkoRecord) {
  return r.fatigue?.toUpperCase() === 'NORMAL' ? 'normal' : 'lelah';
}

export function classifyMentalRecord(r: TenkoRecord) {
  return r.mata?.toUpperCase() === 'OK' ? 'ok' : 'ng';
}

export const TENKO_HEALTH_METRICS: TenkoMetricConfig[] = [
  {
    id: 'tensi',
    title: 'Tensi Darah',
    pieTitle: 'Tensi Percentage',
    classify: classifyTensiRecord,
    categories: [
      { key: 'normal', label: 'Normal', shortLabel: 'Normal', color: '#10b981', pieFilterName: 'Normal' },
      { key: 'hipotensi', label: 'Hipotensi', shortLabel: 'Hipo', color: '#f59e0b', pieFilterName: 'Hipotensi' },
      { key: 'hipertensi', label: 'Hipertensi', shortLabel: 'Hiper', color: '#ef4444', pieFilterName: 'Hipertensi' },
    ],
  },
  {
    id: 'suhu',
    title: 'Suhu Tubuh',
    pieTitle: 'Suhu Percentage',
    classify: classifySuhuRecord,
    categories: [
      { key: 'normal', label: 'Normal', shortLabel: 'Normal', color: '#10b981' },
      { key: 'demam', label: 'Demam (≥37.5°C)', shortLabel: 'Demam', color: '#f97316' },
    ],
  },
  {
    id: 'rest',
    title: 'Waktu Tidur',
    pieTitle: 'Istirahat Percentage',
    classify: classifyRestRecord,
    categories: [
      { key: 'cukup', label: 'Cukup (≥6 Jam)', shortLabel: 'Cukup', color: '#10b981' },
      { key: 'kurang', label: 'Kurang (<6 Jam)', shortLabel: 'Kurang', color: '#f59e0b' },
    ],
  },
  {
    id: 'nadi',
    title: 'Denyut Nadi',
    pieTitle: 'Nadi Percentage',
    classify: classifyNadiRecord,
    categories: [
      { key: 'normal', label: 'Normal (60–100 BPM)', shortLabel: 'Normal', color: '#10b981' },
      { key: 'abnormal', label: 'Abnormal', shortLabel: 'Abnormal', color: '#ef4444' },
    ],
  },
  {
    id: 'alkohol',
    title: 'Alkohol',
    pieTitle: 'Alkohol Percentage',
    classify: classifyAlkoholRecord,
    categories: [
      { key: 'negatif', label: 'Negatif', shortLabel: 'Negatif', color: '#10b981' },
      { key: 'positif', label: 'Positif', shortLabel: 'Positif', color: '#ef4444' },
    ],
  },
  {
    id: 'fatigue',
    title: 'Fatigue',
    pieTitle: 'Fatigue Percentage',
    classify: classifyFatigueRecord,
    categories: [
      { key: 'normal', label: 'Normal', shortLabel: 'Normal', color: '#10b981' },
      { key: 'lelah', label: 'Lelah', shortLabel: 'Lelah', color: '#f59e0b' },
    ],
  },
  {
    id: 'mental',
    title: 'Mental Check (Mata)',
    pieTitle: 'Mental Check Percentage',
    classify: classifyMentalRecord,
    categories: [
      { key: 'ok', label: 'OK', shortLabel: 'OK', color: '#10b981' },
      { key: 'ng', label: 'NG', shortLabel: 'NG', color: '#ef4444' },
    ],
  },
];

export type MetricTrendPoint = {
  period?: string;
  driver?: string;
  total: number;
  [key: string]: number | string | undefined;
};

export type MetricPieSlice = {
  name: string;
  value: number;
  percent: number;
  total: number;
  color: string;
  filterName?: string;
};

export function calculateSummary(records: TenkoRecord[]): TenkoSummary {
  const summary: TenkoSummary = {
    totalCheckups: records.length,
    tensi: { normal: 0, hipertensi: 0, hipotensi: 0 },
    suhu: { normal: 0, demam: 0 },
    alkohol: { negatif: 0, positif: 0 },
    fatigue: { normal: 0, lelah: 0 },
    rest: { cukup: 0, kurang: 0 },
    nadi: { normal: 0, abnormal: 0 },
    mental: { ok: 0, ng: 0 },
    raw: records
  };

  records.forEach(r => {
    summary.tensi[classifyTensiRecord(r) as 'normal' | 'hipertensi' | 'hipotensi']++;
    summary.suhu[classifySuhuRecord(r) as 'normal' | 'demam']++;
    summary.alkohol[classifyAlkoholRecord(r) as 'negatif' | 'positif']++;
    summary.fatigue[classifyFatigueRecord(r) as 'normal' | 'lelah']++;
    summary.rest[classifyRestRecord(r) as 'cukup' | 'kurang']++;
    summary.nadi[classifyNadiRecord(r) as 'normal' | 'abnormal']++;
    summary.mental[classifyMentalRecord(r) as 'ok' | 'ng']++;
  });

  return summary;
}

function emptyTrendPoint(
  metric: TenkoMetricConfig,
  labelKey: 'period' | 'driver',
  label: string
): MetricTrendPoint {
  const point: MetricTrendPoint = { total: 0 };
  point[labelKey] = label;
  metric.categories.forEach(cat => {
    point[cat.key] = 0;
  });
  return point;
}

export function buildPeriodMetricTrends(
  records: TenkoRecord[],
  startDate: string,
  endDate: string,
  granularity: 'day' | 'month',
  metric: TenkoMetricConfig
): MetricTrendPoint[] {
  const map: Record<string, MetricTrendPoint> = {};

  filterRecordsByDateRange(records, startDate, endDate).forEach(item => {
    const period = granularity === 'month' ? item.tanggal.slice(0, 7) : item.tanggal;
    if (!map[period]) map[period] = emptyTrendPoint(metric, 'period', period);
    const status = metric.classify(item);
    map[period][status] = (Number(map[period][status]) || 0) + 1;
    map[period].total = (map[period].total || 0) + 1;
  });

  return Object.values(map).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

export function buildDriverMetricTrends(
  records: TenkoRecord[],
  startDate: string,
  endDate: string,
  metric: TenkoMetricConfig
): MetricTrendPoint[] {
  const map: Record<string, MetricTrendPoint> = {};

  filterRecordsByDateRange(records, startDate, endDate)
    .filter(item => !item.is_assistant)
    .forEach(item => {
      const driver = item.nama_driver || 'Unknown';
      if (!map[driver]) map[driver] = emptyTrendPoint(metric, 'driver', driver);
      const status = metric.classify(item);
      map[driver][status] = (Number(map[driver][status]) || 0) + 1;
      map[driver].total = (map[driver].total || 0) + 1;
    });

  return Object.values(map).sort((a, b) => (b.total || 0) - (a.total || 0));
}

export function getMetricPieSlices(summary: TenkoSummary, metricId: TenkoMetricId): MetricPieSlice[] {
  const metric = TENKO_HEALTH_METRICS.find(m => m.id === metricId);
  if (!metric) return [];

  const total = summary.totalCheckups || 0;
  const toPercent = (count: number) => (total > 0 ? (count / total) * 100 : 0);

  const summaryBucket: Record<TenkoMetricId, Record<string, number>> = {
    tensi: summary.tensi,
    suhu: summary.suhu,
    rest: summary.rest,
    nadi: summary.nadi,
    alkohol: summary.alkohol,
    fatigue: summary.fatigue,
    mental: summary.mental,
  };

  const getCount = (key: string) => summaryBucket[metricId][key] || 0;

  return metric.categories.map(cat => {
    const value = getCount(cat.key);
    return {
      name: cat.label,
      value,
      percent: toPercent(value),
      total,
      color: cat.color,
      filterName: cat.pieFilterName,
    };
  });
}

export type TensiTrendPoint = {
  period: string;
  normal: number;
  hipertensi: number;
  hipotensi: number;
  total: number;
};

export type DriverTensiTrendPoint = {
  driver: string;
  normal: number;
  hipertensi: number;
  hipotensi: number;
  total: number;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function classifyTensiStatus(sistolik: number, diastolik: number): 'normal' | 'hipertensi' | 'hipotensi' {
  const sis = parseInt(String(sistolik)) || 0;
  const dia = parseInt(String(diastolik)) || 0;
  if (sis >= 145 || dia >= 90) return 'hipertensi';
  if (sis < 90 || dia < 60) return 'hipotensi';
  return 'normal';
}

function filterRecordsByDateRange(records: TenkoRecord[], startDate: string, endDate: string) {
  return records.filter(r => r.tanggal >= startDate && r.tanggal <= endDate);
}

export function shouldUseMonthlyTrend(startDate: string, endDate: string) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;
  const dayDiff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return dayDiff > 31;
}

export function buildPeriodTensiTrends(
  records: TenkoRecord[],
  startDate: string,
  endDate: string,
  granularity: 'day' | 'month'
): TensiTrendPoint[] {
  const map: Record<string, TensiTrendPoint> = {};

  filterRecordsByDateRange(records, startDate, endDate).forEach(item => {
    const period = granularity === 'month' ? item.tanggal.slice(0, 7) : item.tanggal;
    if (!map[period]) {
      map[period] = { period, normal: 0, hipertensi: 0, hipotensi: 0, total: 0 };
    }
    map[period][classifyTensiStatus(item.sistolik, item.diastolik)]++;
    map[period].total++;
  });

  return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
}

export function buildDriverTensiTrends(
  records: TenkoRecord[],
  startDate: string,
  endDate: string
): DriverTensiTrendPoint[] {
  const map: Record<string, DriverTensiTrendPoint> = {};

  filterRecordsByDateRange(records, startDate, endDate)
    .filter(item => !item.is_assistant)
    .forEach(item => {
      const driver = item.nama_driver || 'Unknown';
      if (!map[driver]) {
        map[driver] = { driver, normal: 0, hipertensi: 0, hipotensi: 0, total: 0 };
      }
      map[driver][classifyTensiStatus(item.sistolik, item.diastolik)]++;
      map[driver].total++;
    });

  return Object.values(map).sort((a, b) => b.total - a.total);
}

export function formatTrendPeriodLabel(period: string, granularity: 'day' | 'month') {
  if (granularity === 'month') {
    const [y, m] = period.split('-');
    return `${MONTH_LABELS[Number(m) - 1]} '${y.slice(2)}`;
  }
  return period.split('-').slice(1).reverse().join('/');
}

export function matchesPeriodFilter(tanggal: string, filter: string) {
  return filter.length === 7 ? tanggal.startsWith(filter) : tanggal === filter;
}

export async function fetchTenkoData(startDate: string, endDate: string, customer: string = 'ALL', area: string = 'ALL', personnelType: string = 'ALL') {
  try {
    console.log('Fetching Tenko Data:', { startDate, endDate, customer, area, personnelType });
    // Pagination memakai keyset (id) biar aman & nggak ada baris yang ke-skip
    // saat data > 1 halaman — pindah dari offset .range().
    // NOTE: DO NOT dedup berdasarkan (driver + timestamp) — 1 sesi cek bisa punya
    // 2 pengukuran valid (tensi tinggi lalu normal) dengan timestamp sama persis.
    // Dedup cukup by id unik baris (anti duplikat sync beneran).
    const allData: TenkoRecord[] = [];
    const seenIds = new Set<string>();
    let lastId: string | null = null;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('tenko')
        .select('*')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('id', { ascending: true })
        .limit(step);

      if (customer && customer !== 'ALL') query = query.eq('customer', customer);
      if (area && area !== 'ALL') query = query.eq('area', area);
      
      // Filter Driver/Assistant di level Database
      if (personnelType === 'DRIVER') query = query.eq('is_assistant', false);
      if (personnelType === 'ASST') query = query.eq('is_assistant', true);

      if (lastId) query = query.gt('id', lastId);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach((item: any) => {
          if (item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            allData.push(item as TenkoRecord);
          }
        });
        if (data.length < step) hasMore = false;
        else {
          lastId = data[data.length - 1].id;
          // Guard: kalau id terakhir sama dengan sebelumnya (data statis), hindari infinite loop
          if (allData.length > 60000) hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log('Total Records Fetched:', allData.length);

    // Urutkan untuk tampilan: tanggal terbaru dulu, lalu jam cek terbaru.
    // (Pagination by id, tapi user paling peduli cek yang paling baru.)
    allData.sort((a, b) => {
      const d = String(b.tanggal).localeCompare(String(a.tanggal));
      if (d !== 0) return d;
      return String(b.timestamp).localeCompare(String(a.timestamp));
    });

    const summary = calculateSummary(allData);
    const dailyMap: Record<string, any> = {};
    allData.forEach(item => {
      const date = item.tanggal;
      if (!dailyMap[date]) {
        dailyMap[date] = { date, normal: 0, hipertensi: 0, hipotensi: 0, total: 0 };
      }
      const sis = parseInt(String(item.sistolik)) || 0;
      const dia = parseInt(String(item.diastolik)) || 0;
      
      if (sis >= 145 || dia >= 90) dailyMap[date].hipertensi++;
      else if (sis < 90 || dia < 60) dailyMap[date].hipotensi++;
      else dailyMap[date].normal++;
      dailyMap[date].total++;
    });

    return {
      raw: allData,
      summary: summary,
      trends: Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date))
    };
  } catch (error) {
    console.error('Error fetching tenko data:', error);
    return { raw: [], summary: null, trends: [] };
  }
}

export async function fetchUniqueAreas() {
  try {
    // Cara terbaik: pakai RPC biar tinggal SELECT DISTINCT
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_unique_areas');
    if (!rpcError && rpcData) {
      const areas = rpcData.map((item: any) => item.area_name).filter(Boolean);
      console.log('Areas via RPC:', areas);
      return ['ALL', ...areas];
    }

    // Fallback: Loop sampe 10 halaman (10.000 baris) biar Bekasi yang ada di baris 6700+ ikut kena
    const foundAreas = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase
        .from('tenko')
        .select('area')
        .range(i * 1000, (i + 1) * 1000 - 1);
      
      if (!data || data.length === 0) break;
      data.forEach(d => { if (d.area) foundAreas.add(d.area); });
    }

    const unique = Array.from(foundAreas).filter(Boolean).sort();
    console.log('Areas via Fallback Loop:', unique);
    return ['ALL', ...unique as string[]];
  } catch (error) {
    console.error('fetchUniqueAreas error:', error);
    return ['ALL', 'KARAWANG', 'BEKASI'];
  }
}

/**
 * Fetch dynamic list of unique customers from the data
 */
export type TensiFaktorUpdateTarget = Pick<
  TenkoRecord,
  'id' | 'tanggal' | 'timestamp' | 'nama_driver' | 'nik' | 'driver_id'
>;

export async function updateTensiFaktor(
  record: TensiFaktorUpdateTarget,
  tensi_faktor: string,
  tensi_keterangan: string | null
): Promise<{ success: boolean; error?: string }> {
  const payload = { tensi_faktor, tensi_keterangan };

  const { data: rpcData, error: rpcError } = await supabase.rpc('update_tenko_tensi_faktor', {
    p_id: record.id || null,
    p_tanggal: record.tanggal,
    p_timestamp: record.timestamp,
    p_nama_driver: record.nama_driver || null,
    p_nik: record.nik || null,
    p_tensi_faktor: tensi_faktor,
    p_tensi_keterangan: tensi_keterangan,
  });

  if (!rpcError) {
    const rows = Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
    if (rows.length > 0) return { success: true };
  } else if (rpcError.code !== 'PGRST202') {
    // PGRST202 = function not found (migration belum dijalankan)
    console.warn('update_tenko_tensi_faktor RPC:', rpcError.message);
  }

  if (record.id) {
    const { data, error } = await supabase
      .from('tenko')
      .update(payload)
      .eq('id', record.id)
      .select('id')
      .maybeSingle();

    if (!error && data) return { success: true };
    if (error) console.warn('updateTensiFaktor by id:', error.message);
  }

  let query = supabase
    .from('tenko')
    .update(payload)
    .eq('tanggal', record.tanggal)
    .eq('timestamp', record.timestamp);

  if (record.nik) {
    query = query.eq('nik', record.nik);
  } else if (record.driver_id) {
    query = query.eq('driver_id', record.driver_id);
  } else {
    query = query.eq('nama_driver', record.nama_driver);
  }

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    console.error('updateTensiFaktor error:', error);
    return { success: false, error: error.message };
  }

  if (!data) {
    return {
      success: false,
      error: 'Data tidak tersimpan. Pastikan sudah login dan migration Supabase sudah dijalankan.',
    };
  }

  return { success: true };
}

export async function fetchUniqueCustomers(area: string = 'ALL') {
  try {
    const { data: rpcData, error: rpcError } = area && area !== 'ALL'
      ? await supabase.rpc('get_unique_customers', { p_area: area })
      : await supabase.rpc('get_unique_customers');

    if (!rpcError && rpcData) {
      const customers = rpcData
        .map((item: { customer_name?: string; customer?: string }) => item.customer_name || item.customer)
        .filter(Boolean);
      console.log('Customers via RPC:', customers);
      return ['ALL', ...customers.sort()];
    }

    // Fallback: paginate through table — single .limit() misses customers buried past early rows (e.g. ADM-heavy head)
    const foundCustomers = new Set<string>();
    const step = 1000;
    for (let i = 0; i < 50; i++) {
      let query = supabase
        .from('tenko')
        .select('customer')
        .range(i * step, (i + 1) * step - 1);

      if (area && area !== 'ALL') {
        query = query.eq('area', area);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach(d => { if (d.customer) foundCustomers.add(d.customer); });
      if (data.length < step) break;
    }

    const unique = Array.from(foundCustomers).filter(Boolean).sort();
    console.log('Customers via fallback loop:', unique);
    return ['ALL', ...unique];
  } catch (error) {
    console.error('Error fetching unique customers:', error);
    return ['ALL', 'TAM', 'TMMIN'];
  }
}
