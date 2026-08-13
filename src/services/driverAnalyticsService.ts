import { supabase } from '../lib/supabase';
import { fetchEcoViolations, EcoViolation, buildMonthFiltersForRange } from './ecoDataFetcher';
import { DriverViolationMonth, DriverCoachingSession } from '../types';

// ─── Helper: parse violation "Tanggal" field (DD Mon YY) to JS Date ─────────────
const MONTH_MAP: Record<string, number> = { 
  'Jan': 0, 'Januari': 0, 'Feb': 1, 'Februari': 1, 'Mar': 2, 'Maret': 2,
  'Apr': 3, 'Mei': 4, 'May': 4, 'Jun': 5, 'Juni': 5, 'Jul': 6, 'Juli': 6,
  'Agu': 7, 'Aug': 7, 'Agustus': 7, 'Sep': 8, 'September': 8,
  'Okt': 9, 'Oct': 9, 'Oktober': 9, 'Nov': 10, 'November': 10,
  'Des': 11, 'Dec': 11, 'Desember': 11
};

export function parseViolationDate(vDate: string): Date | null {
  if (!vDate) return null;
  const parts = vDate.trim().split(/[\s-]+/);
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const monthKey = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
  const monthIdx = MONTH_MAP[monthKey];
  if (monthIdx === undefined) return null;
  
  const rawYear = parseInt(parts[2]);
  const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
  return new Date(fullYear, monthIdx, day);
}

// ─── Helper: get month range filters for a single month (YYYY-MM) ───────────────
export function getMonthFilters(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
  
  // Use the existing buildMonthFiltersForRange
  const filters = buildMonthFiltersForRange(startDate, endDate);
  return [...new Set(filters)];
}

// ─── Get violations for a specific month ────────────────────────────────────────
export async function fetchViolationsForMonth(
  month: string,
  options?: {
    area?: string;
    customer?: string;
    driverId?: string;
    driverName?: string;
    cabang?: string;
  }
): Promise<EcoViolation[]> {
  const monthFilters = getMonthFilters(month);
  const promises = monthFilters.map(f => fetchEcoViolations({
    area: options?.area,
    customer: options?.customer,
    monthFilter: f,
    driverId: options?.driverId,
    driverName: options?.driverName,
    cabang: options?.cabang,
  }));

  const results = await Promise.all(promises);
  const allData: EcoViolation[] = [];
  for (const violations of results) {
    if (!violations || violations.length === 0) continue;
    allData.push(...violations);
  }

  // Deduplicate by id and sort by date descending
  const unique = Array.from(new Map(allData.map((v: EcoViolation) => [v.id, v])).values());
  unique.sort((a, b) => {
    const da = parseViolationDate(a.tanggal);
    const db = parseViolationDate(b.tanggal);
    return (db?.getTime() || 0) - (da?.getTime() || 0);
  });
  return unique;
}

// ─── Get coaching sessions for a specific month ─────────────────────────────────
export async function fetchCoachingForMonth(
  month: string,
  options?: {
    driverId?: string;
    area?: string;
    cabang?: string;
  }
): Promise<DriverCoachingSession[]> {
  const [y, m] = month.split('-').map(Number);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

  try {
    let query = supabase
      .from('driver_coaching_sessions')
      .select('*')
      .gte('violation_date', startDate)
      .lte('violation_date', endDate);

    if (options?.driverId) {
      query = query.eq('driver_id', options.driverId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching coaching sessions:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      driver_id: item.driver_id,
      violation_id: item.violation_id,
      violation_date: item.violation_date,
      coached_by: item.coached_by,
      notes: item.notes,
      status: item.status as 'pending' | 'completed' | 'cancelled',
      created_at: item.created_at,
    })) as DriverCoachingSession[];
  } catch (e) {
    console.error('Unexpected error fetching coaching sessions:', e);
    return [];
  }
}

// ─── Resolve driver_id dari nama (untuk violation yang driver_id-nya kosong) ───
let driversNameMapCache: { byName: Record<string, string> } | null = null;

export async function getDriversNameIdMap(): Promise<Record<string, string>> {
  if (driversNameMapCache) return driversNameMapCache.byName;
  try {
    const { data } = await supabase.from('drivers').select('id, name');
    const map: Record<string, string> = {};
    (data || []).forEach((d: any) => {
      const normalized = String(d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized) map[normalized] = d.id;
    });
    driversNameMapCache = { byName: map };
    return map;
  } catch (e) {
    console.error('Error fetching drivers map:', e);
    return {};
  }
}

function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export async function resolveDriverId(driverId: string | null, driverName: string): Promise<string | null> {
  if (isValidUuid(driverId)) return driverId.trim();
  const nameMap = await getDriversNameIdMap();
  const normalized = String(driverName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return nameMap[normalized] || null;
}

// ─── Fetch driver monthly summary (violations + coaching counts) ───────────────
export async function fetchDriverViolationSummary(
  month: string,
  options?: {
    area?: string;
    customer?: string;
    cabang?: string;
    isTAM?: boolean;
  }
): Promise<DriverViolationMonth[]> {
  try {
    // 1️⃣ Fetch all violations for the month
    const violations = await fetchViolationsForMonth(month, {
      area: options?.area,
      customer: options?.customer,
      cabang: options?.cabang,
    });

    // Apply TAM filter (same logic as EcoDrivingPage)
    let filteredViolations = violations;
    if (options?.isTAM) {
      filteredViolations = violations.filter((v: EcoViolation) => {
        const area = (v.area || '').toUpperCase();
        const proj = (v.customer || '').toUpperCase();
        return !area.includes('SULAWESI') && !proj.includes('TMMIN');
      });
    }

    // 2️⃣ Fetch coaching sessions for the same month
    const coachingSessions = await fetchCoachingForMonth(month, {
      area: options?.area,
      cabang: options?.cabang,
    });

    // 3️⃣ Group violations by driver (resolve empty driver_id via name)
    const driverMap: Record<string, DriverViolationMonth> = {};
    const resolvedIdCache: Record<string, string> = {};
    for (const v of filteredViolations) {
      let did = isValidUuid(v.driver_id) ? v.driver_id!.trim() : '';
      if (!did && v.pengemudi) {
        if (resolvedIdCache[v.pengemudi] === undefined) {
          resolvedIdCache[v.pengemudi] = (await resolveDriverId(v.driver_id, v.pengemudi)) || '';
        }
        did = resolvedIdCache[v.pengemudi];
      }
      const key = `${did || 'unknown'}||${v.pengemudi}`;
      if (!driverMap[key]) {
        driverMap[key] = {
          driver_id: did || null,
          driver_name: v.pengemudi,
          plat_nomor: v.plat_nomor || '-',
          month,
          violation_count: 0,
          coaching_count: 0,
          last_violation_date: undefined,
          last_coaching_date: undefined,
        };
      }
      driverMap[key].violation_count += 1;

      const vDate = parseViolationDate(v.tanggal);
      if (vDate) {
        const dateStr = v.tanggal || '';
        const lastDate = parseViolationDate(driverMap[key].last_violation_date || '');
        if (!driverMap[key].last_violation_date || (lastDate?.getTime() || 0) < (vDate?.getTime() || 0)) {
          driverMap[key].last_violation_date = dateStr;
        }
      }
    }

    // 4️⃣ Add coaching counts per driver
    coachingSessions.forEach((cs: DriverCoachingSession) => {
      const key = `${cs.driver_id || 'unknown'}||`;
      // Find matching driver by driver_id
      const matchingKey = Object.keys(driverMap).find(k => {
        const [did] = k.split('||');
        return did === (cs.driver_id || 'unknown');
      });
      
      if (matchingKey) {
        driverMap[matchingKey].coaching_count += 1;
        if (cs.violation_date) {
          const csDate = parseViolationDate(cs.violation_date);
          if (csDate) {
            const lastCoachingDate = parseViolationDate(driverMap[matchingKey].last_coaching_date || '');
            if (!driverMap[matchingKey].last_coaching_date || (lastCoachingDate?.getTime() || 0) < (csDate?.getTime() || 0)) {
              driverMap[matchingKey].last_coaching_date = cs.violation_date;
            }
          }
        }
      }
    });

    return Object.values(driverMap);
  } catch (e) {
    console.error('Error fetching driver violation summary:', e);
    return [];
  }
}

// ─── Fetch detailed violations for a driver in a month ──────────────────────────
export async function fetchDriverViolationDetail(
  driverId: string,
  month: string,
  options?: {
    area?: string;
    customer?: string;
    cabang?: string;
  }
): Promise<EcoViolation[]> {
  return fetchViolationsForMonth(month, {
    driverId,
    area: options?.area,
    customer: options?.customer,
    cabang: options?.cabang,
  });
}

// ─── Fetch detailed coaching sessions for a driver in a month ───────────────────
export async function fetchDriverCoachingDetail(
  driverId: string,
  month: string
): Promise<DriverCoachingSession[]> {
  return fetchCoachingForMonth(month, { driverId });
}

// ─── Manual coaching: tandai driver sudah dicoaching untuk violation tertentu ────
export async function createManualCoachingSession(params: {
  driver_id: string;
  violation_id: number;
  violation_date: string;
  notes?: string;
}): Promise<{ success: boolean; error?: any }> {
  try {
    // driver_id harus UUID valid; jika kosong/invalid kirim null (kolom nullable)
    const driverId = isValidUuid(params.driver_id) ? params.driver_id.trim() : null;

    const { error } = await supabase
      .from('driver_coaching_sessions')
      .insert({
        driver_id: driverId,
        violation_id: params.violation_id,
        violation_date: params.violation_date,
        coached_by: 'MANUAL',
        notes: params.notes || 'Ditandai manual sudah dicoaching',
        status: 'completed',
      });
    if (error) return { success: false, error };
    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}

// ─── Hapus / batalkan tandai coaching (unmark) ─────────────────────────────────
export async function deleteCoachingSession(sessionId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('driver_coaching_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) return { success: false, error };
    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}

// ─── Export helpers ─────────────────────────────────────────────────────────────
export function exportToCSV(rows: any[], filename: string): void {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Escape values containing commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
