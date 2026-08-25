import { supabase } from '../lib/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface EcoViolation {
  id: number;
  tanggal: string;
  waktu: string;
  plat_nomor: string;
  pengemudi: string;
  driver_id: string | null;
  jenis_peringatan: 'Akselerasi Mendadak' | 'Perlambatan Mendadak' | 'Tikungan Tajam' | 'Kecepatan Melebihi Batas' | string;
  tingkat_urgensi: string;
  detail: string;
  lokasi: string;
  latitude: number | null;
  longitude: number | null;
  koordinat?: string;
  area: string;
  customer?: string;
  grup_kendaraan: string;
  _optimizedType?: string;
}

export interface DriverRanking {
  driver: string;
  plat: string;
  driver_id: string | null;
  total: number;
  akselerasi: number;
  perlambatan: number;
  tikungan: number;
  kecepatan: number;
}

export interface ViolationByDate {
  date: string;
  perlambatan: number;
  akselerasi: number;
  tikungan: number;
  kecepatan: number;
}

export interface EcoSummary {
  total: number;
  akselerasi: number;
  perlambatan: number;
  tikungan: number;
  kecepatan: number;
  topDriver: string;
  topDriverTotal: number;
}

// ─── BUILD MONTH FILTERS (handles mixed EN/ID + dash/space + 2/4-digit year) ──
const ECO_MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ECO_MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export function buildMonthFiltersForRange(startDate: string, endDate: string): string[] {
  const filters: string[] = [];
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return filters;
  let current = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1);
  while (current <= last) {
    const y2 = current.getFullYear().toString().slice(-2);
    const y4 = current.getFullYear().toString();
    const mEN = ECO_MONTH_EN[current.getMonth()];
    const mID = ECO_MONTH_ID[current.getMonth()];
    filters.push(
      `%-${mEN}-${y2}`, `%-${mID}-${y2}`,
      `% ${mEN} ${y4}`, `% ${mID} ${y4}`,
      `% ${mEN} ${y2}`, `% ${mID} ${y2}`,
      `%${mEN}%${y4}`, `%${mID}%${y4}`,
      `%${mEN}%${y2}`, `%${mID}%${y2}`,
    );
    current.setMonth(current.getMonth() + 1);
  }
  return [...new Set(filters)];
}

// ─── FETCH ALL VIOLATIONS (with optional filters) ─────────────────────────────
export async function fetchEcoViolations(options?: {
  area?: string;
  customer?: string;
  startDate?: string;
  endDate?: string;
  driverId?: string;
  driverName?: string;
  monthFilter?: string; // e.g., '%-Apr-26' for fast DB filtering
  cabang?: string;
}): Promise<EcoViolation[]> {
  // 1. Get Exact Count First
  let countQuery = supabase.from('eco_driving_violations').select('*', { count: 'exact', head: true });
  if (options?.driverId && options?.driverName) {
    const prefix = options.driverName.split(' ')[0] + '%';
    countQuery = countQuery.or(`driver_id.eq.${options.driverId},Pengemudi.ilike.${prefix}`);
  } else if (options?.driverId) {
    countQuery = countQuery.eq('driver_id', options.driverId);
  } else if (options?.driverName) {
    countQuery = countQuery.ilike('Pengemudi', options.driverName.split(' ')[0] + '%');
  }
  if (options?.area && options.area !== 'ALL') countQuery = countQuery.eq('Area', options.area);
  if (options?.customer && options.customer !== 'ALL') countQuery = countQuery.eq('Customer', options.customer);
  if (options?.monthFilter) countQuery = countQuery.ilike('Tanggal', options.monthFilter);
  if (options?.cabang && options.cabang !== 'ALL') {
    if (options.cabang === 'SULAWESI') {
      // SULAWESI adalah cabang tersendiri
      countQuery = countQuery.ilike('Area', '%SULAWESI%');
    } else if (options.cabang === 'KARAWANG') {
      // Cabang KARAWANG = semua area kecuali SULAWESI
      countQuery = countQuery.not('Area', 'ilike', '%SULAWESI%');
    }
  }

  const { count, error: countError } = await countQuery;
    if (countError || count === null || count === 0) return [];

  // 2. Fetch in Parallel
  const pageSize = 1000;
  const totalPages = Math.ceil(count / pageSize);
  const promises = [];

  for (let i = 0; i < totalPages; i++) {
    const from = i * pageSize;
    let query = supabase
      .from('eco_driving_violations')
      .select('*')
      .order('Tanggal', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);

    if (options?.driverId && options?.driverName) {
      const prefix = options.driverName.split(' ')[0] + '%';
      query = query.or(`driver_id.eq.${options.driverId},Pengemudi.ilike.${prefix}`);
    } else if (options?.driverId) {
      query = query.eq('driver_id', options.driverId);
    } else if (options?.driverName) {
      query = query.ilike('Pengemudi', options.driverName.split(' ')[0] + '%');
    }
    if (options?.area && options.area !== 'ALL') query = query.eq('Area', options.area);
    if (options?.customer && options.customer !== 'ALL') query = query.eq('Customer', options.customer);
    if (options?.monthFilter) query = query.ilike('Tanggal', options.monthFilter);
    if (options?.cabang && options.cabang !== 'ALL') {
      if (options.cabang === 'SULAWESI') {
        query = query.ilike('Area', '%SULAWESI%');
      } else if (options.cabang === 'KARAWANG') {
        // Cabang KARAWANG = semua area kecuali SULAWESI
        query = query.not('Area', 'ilike', '%SULAWESI%');
      }
    }

    promises.push(query);
  }

  const results = await Promise.all(promises);
    let allData: EcoViolation[] = [];

  for (const { data, error } of results) {
    if (error || !data) continue;
    const mapped = data.map((item: any, idx: number) => {
      // Deterministic numeric hash based on data if ID is missing
      const str = `${item.Tanggal}-${item.Waktu}-${item.Pengemudi}-${item.Lokasi}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
      return {
      id: item.id || Math.abs(hash) + idx, // fallback id
      tanggal: item.Tanggal || '',
      waktu: item.Waktu || '',
      plat_nomor: item["Plat Nomor"] || '',
      pengemudi: item.Pengemudi || '',
      driver_id: item.driver_id,
      jenis_peringatan: item["Jenis Peringatan"] || '',
      tingkat_urgensi: item["Tingkat Urgensi"] || '',
      detail: item.Detail || '',
      lokasi: item.Lokasi || '',
      latitude: parseFloat(item.Latitude) || null,
      longitude: parseFloat(item.Longitude) || null,
      koordinat: item.Koordinat || '',
      area: item.Area || '',
      customer: item.Customer || '',
      grup_kendaraan: item["Grup Kendaraan"] || ''
      };
    });
    allData = [...allData, ...mapped];
  }

  // Ensure strict chronological order across chunks
  allData.sort((a, b) => b.id - a.id);
  
  return allData;
}

// ─── COMPUTE DRIVER RANKINGS ──────────────────────────────────────────────────
export function computeDriverRankings(violations: EcoViolation[]): DriverRanking[] {
  const map: Record<string, DriverRanking> = {};

  violations.forEach(v => {
    // Samakan persis dengan Looker Studio: pisahkan row jika 1 driver bawa 2 Plat berbeda!
    const key = `${v.pengemudi || 'Tanpa Nama'}||${v.plat_nomor || '-'}`;
    
    if (!map[key]) {
      map[key] = {
        driver: v.pengemudi || 'Tanpa Nama',
        plat: v.plat_nomor || '-',
        driver_id: v.driver_id,
        total: 0,
        akselerasi: 0,
        perlambatan: 0,
        tikungan: 0,
        kecepatan: 0,
      };
    }
    map[key].total += 1;
    const jenis = v.jenis_peringatan?.toLowerCase() || '';
    if (jenis.includes('akselerasi'))   map[key].akselerasi += 1;
    if (jenis.includes('perlambatan'))  map[key].perlambatan += 1;
    if (jenis.includes('tikungan'))     map[key].tikungan += 1;
    if (jenis.includes('kecepatan'))    map[key].kecepatan += 1;
  });

  return Object.values(map).sort((a, b) => b.total - a.total);
}

// ─── COMPUTE VIOLATIONS BY DATE ───────────────────────────────────────────────
export function computeViolationsByDate(violations: EcoViolation[]): ViolationByDate[] {
  const dayMap: Record<string, ViolationByDate> = {};

  violations.forEach(v => {
    const date = v.tanggal;
    if (!date) return;
    if (!dayMap[date]) {
      dayMap[date] = { date, perlambatan: 0, akselerasi: 0, tikungan: 0, kecepatan: 0 };
    }
    const jenis = v.jenis_peringatan?.toLowerCase() || '';
    if (jenis.includes('akselerasi'))  dayMap[date].akselerasi += 1;
    if (jenis.includes('perlambatan')) dayMap[date].perlambatan += 1;
    if (jenis.includes('tikungan'))    dayMap[date].tikungan += 1;
    if (jenis.includes('kecepatan'))   dayMap[date].kecepatan += 1;
  });

  const parseDayStr = (dStr: string): number => {
    // Format: "DD Mon YY" e.g. "01 Jun 26"
    const parts = dStr.split(/[\s-]/);
    if (parts.length !== 3) return 0;
    const mMap: Record<string, number> = { 'jan':0,'feb':1,'mar':2,'apr':3,'may':4,'mei':4,'jun':5,'jul':6,'aug':7,'agu':7,'sep':8,'oct':9,'okt':9,'nov':10,'dec':11,'des':11 };
    const m = mMap[parts[1].toLowerCase().substring(0,3)] ?? 0;
    const y = parseInt(parts[2]);
    return new Date(y < 100 ? 2000 + y : y, m, parseInt(parts[0])).getTime();
  };

  const sortedDays = Object.values(dayMap).sort((a, b) => parseDayStr(a.date) - parseDayStr(b.date));

  // Auto-switch to monthly grouping if more than 31 distinct days
  if (sortedDays.length > 31) {
    const monthMap: Record<string, ViolationByDate> = {};
    const monthOrder: Record<string, number> = {};
    sortedDays.forEach(day => {
      const ts = parseDayStr(day.date);
      if (!ts) return;
      const d = new Date(ts);
      // Label: full month name in Indonesian, e.g. "Juni", "Juli"
      const monthLabel = d.toLocaleDateString('id-ID', { month: 'long' });
      if (!monthMap[monthLabel]) {
        monthMap[monthLabel] = { date: monthLabel, perlambatan: 0, akselerasi: 0, tikungan: 0, kecepatan: 0 };
        monthOrder[monthLabel] = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      }
      monthMap[monthLabel].akselerasi  += day.akselerasi;
      monthMap[monthLabel].perlambatan += day.perlambatan;
      monthMap[monthLabel].tikungan    += day.tikungan;
      monthMap[monthLabel].kecepatan   += day.kecepatan;
    });
    return Object.values(monthMap).sort((a, b) => (monthOrder[a.date] || 0) - (monthOrder[b.date] || 0));
  }

  return sortedDays.slice(-31); // show up to 31 days max
}

// ─── COMPUTE SUMMARY ──────────────────────────────────────────────────────────
export function computeEcoSummary(violations: EcoViolation[], rankings: DriverRanking[]): EcoSummary {
  const total = violations.length;
  const perlambatan = violations.filter(v => v.jenis_peringatan?.toLowerCase().includes('perlambatan')).length;
  const akselerasi  = violations.filter(v => v.jenis_peringatan?.toLowerCase().includes('akselerasi')).length;
  const tikungan    = violations.filter(v => v.jenis_peringatan?.toLowerCase().includes('tikungan')).length;
  const kecepatan   = violations.filter(v => v.jenis_peringatan?.toLowerCase().includes('kecepatan')).length;
  const topDriver   = rankings[0]?.driver || '-';
  const topDriverTotal = rankings[0]?.total || 0;

  return { total, akselerasi, perlambatan, tikungan, kecepatan, topDriver, topDriverTotal };
}
