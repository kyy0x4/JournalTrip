import { supabase } from '../lib/supabase';
import { Driver, Ritase, RitaseStep } from '../types';

const NGORO_PDC_CODES = ['MJKT', 'MKJT'];

type TripAreaRow = { area?: string | null; pdc_bongkar?: string | null };

/** Area operasional untuk Journal Trip — NGORO sering tersimpan area=JBK dengan tujuan MJKT/MKJT */
export function resolveTripJournalArea(trip: TripAreaRow): string {
  const area = (trip.area || '').toUpperCase().trim();
  const bongkar = (trip.pdc_bongkar || '').toUpperCase().trim();

  if (area === 'NGORO' || NGORO_PDC_CODES.includes(bongkar)) return 'NGORO';
  if (area === 'SUMATERA') return 'SUMATERA';
  if (area === 'TMMIN') return 'TMMIN';
  return 'JBK';
}

function tripMatchesJournalArea(trip: TripAreaRow, selectedArea: string): boolean {
  if (!selectedArea || selectedArea === 'ALL') return true;
  if (selectedArea === 'TAM') {
    return ['JBK', 'NGORO', 'SUMATERA'].includes(resolveTripJournalArea(trip));
  }
  return resolveTripJournalArea(trip) === selectedArea;
}

/** Default shift operasional berdasarkan jam WIB */
export function getDefaultOperationalShift(): 'Day' | 'Night' {
  const wibHour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date())
  );
  return wibHour >= 6 && wibHour < 18 ? 'Day' : 'Night';
}

function applyTripAreaQuery<T extends { or: (filters: string) => T; in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T }>(
  query: T,
  area: string
): T {
  if (!area || area === 'ALL') return query;
  if (area === 'TAM') return query.in('area', ['JBK', 'NGORO', 'SUMATERA']);
  if (area === 'NGORO') return query.or('area.eq.NGORO,pdc_bongkar.in.(MJKT,MKJT)');
  if (area === 'JBK') return query.in('area', ['JBK', 'NGORO']);
  return query.eq('area', area);
}

function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.length >= 5 ? t.substring(0, 5) : t;
}

function calculateDuration(start: string | null, end: string | null, area: string = 'JBK'): string {
  if (!start || !end || start === '--:--' || end === '--:--') return '--';
  try {
    const s = start.split(':').map(Number);
    const e = end.split(':').map(Number);
    let diff = (e[0] * 60 + e[1]) - (s[0] * 60 + s[1]);
    
    // Handle cross-midnight
    if (diff < 0) diff += 1440;
    
    // Handle Long Haul Cross-Day (>20h)
    if (area !== 'JBK' && diff < 900) {
      diff += 1440;
    }
    
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  } catch (e) { return '--'; }
}

function calculateSIMStatus(expiryDate: string | null): 'Valid' | 'Expired' | 'Warning' | '--' {
  if (!expiryDate) return '--';
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (diffDays < 30) return 'Warning';
  return 'Valid';
}

export async function fetchActiveDrivers(selectedDate: string, area: string = 'JBK', shift?: string) {
  try {
    let query = supabase
      .from('trips')
      .select(`
        driver_id,
        no_polisi,
        shift,
        area,
        drivers!inner (
          id,
          name,
          avatar_url,
          no_polisi
        )
      `)
      .eq('tanggal', selectedDate);

    query = applyTripAreaQuery(query, area);

    if (shift) {
      query = query.ilike('shift', `%${shift}%`);
    }

    const { data: trips, error } = await query;
    if (error) throw error;

    const areaFilteredTrips = (trips || []).filter((row: TripAreaRow) =>
      tripMatchesJournalArea(row, area)
    );

    const uniqueDrivers = new Map<string, Driver>();
    areaFilteredTrips.forEach((row: any) => {
      const driver = row.drivers;
      if (driver && !uniqueDrivers.has(driver.id)) {
        uniqueDrivers.set(driver.id, {
          id: driver.id,
          name: driver.name,
          status: 'online' as 'online' | 'offline', 
          avatar: driver.avatar_url || null,
          noPolisi: row.no_polisi || driver.no_polisi || '--' // Gunakan NoPol dari TRIP hari itu
        });
      }
    });

    return Array.from(uniqueDrivers.values());
  } catch (error) {
    console.error('Error fetch drivers:', error);
    throw error;
  }
}

export async function fetchAllDrivers() {
  const { data } = await supabase.from('drivers').select('*').order('name');
  return data?.map(d => ({
    id: d.id, 
    name: d.name, 
    status: 'offline' as 'online' | 'offline', 
    avatar: d.avatar_url,
    noPolisi: d.no_polisi, 
    simExpiry: d.sim_expiry, 
    simPhotoUrl: d.sim_photo_url,
    simStatus: calculateSIMStatus(d.sim_expiry),
    nik: d.nik,
    phone: d.phone,
    alamat: d.alamat
  })) || [];
}

export async function fetchDriverProfile(driverId: string, month: string) { // month format: 'YYYY-MM'
  try {
    // 1. Fetch Driver Info (High-Resilience Lookup)
    let driverData = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(driverId);

    if (isUUID) {
      const { data: byId } = await supabase.from('drivers').select('*').eq('id', driverId).maybeSingle();
      if (byId) driverData = byId;
    }

    if (!driverData) {
      // Fetch all drivers to do a normalized comparison (handles spacing/dot variations)
      const { data: allDrivers } = await supabase.from('drivers').select('*');
      if (allDrivers) {
        const targetSlug = driverId.toLowerCase().replace(/[^a-z0-9]/g, '');
        driverData = allDrivers.find(d => {
          const driverSlug = d.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return driverSlug === targetSlug || d.id === driverId;
        });
      }
    }
    
    if (!driverData) {
      console.error(`Driver not found for identifier: ${driverId}`);
      return null;
    }

    // 2. Fetch Trips for the month
    const startOfMonth = `${month}-01`;
    const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
    const endOfMonth = `${month}-${lastDay}`;

    const { data: monthTrips, error: tError } = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', driverData.id)
      .gte('tanggal', startOfMonth)
      .lte('tanggal', endOfMonth)
      .order('tanggal', { ascending: false })
      .order('ritase_no', { ascending: true });

    if (tError) throw tError;

    // 3. Process Ritases
    const ritases: (Ritase & { tanggal: string })[] = (monthTrips || []).map((row: any, idx: number) => {
      const isFinished = !!row.actual_unloading;
      const isActive = !!row.actual_outpool && !isFinished;

      return {
        id: row.id || idx + 1,
        tanggal: row.tanggal,
        ritaseNo: row.ritase_no, 
        route: `${row.pdc_muat || '---'} → ${row.pdc_bongkar || '---'}`, 
        status: (isFinished ? 'finished' : (isActive ? 'active' : 'locked')) as any,
        type: (isFinished ? 'completed' : (isActive ? 'active' : 'locked')) as any,
        duration: calculateDuration(row.actual_in_pdc, row.actual_unloading, row.area),
        timeline: [
          { label: 'OUTPOOL', actual: fmtTime(row.actual_outpool) || '--:--', type: (row.actual_outpool ? 'completed' : 'pending') as any },
          { label: 'IN PDC', plan: fmtTime(row.plan_dccp) || '--:--', actual: fmtTime(row.actual_in_pdc) || '--:--', type: (row.actual_in_pdc ? 'completed' : (isActive ? 'active' : 'pending')) as any },
          { label: 'OUT PDC', actual: fmtTime(row.actual_out_pdc) || '--:--', type: (row.actual_out_pdc ? 'completed' : (row.actual_in_pdc ? 'active' : 'pending')) as any },
          { label: 'UNLOADING', plan: fmtTime(row.plan_unloading) || '--:--', actual: fmtTime(row.actual_unloading) || '--:--', type: (row.actual_unloading ? 'completed' : (row.actual_out_pdc ? 'active' : 'pending')) as any }
        ]
      };
    });

    return {
      driver: {
        id: driverData.id,
        name: driverData.name,
        status: 'online' as 'online' | 'offline', // Placeholder
        avatar: driverData.avatar_url,
        noPolisi: driverData.no_polisi,
        simExpiry: driverData.sim_expiry,
        simPhotoUrl: driverData.sim_photo_url,
        simStatus: calculateSIMStatus(driverData.sim_expiry),
        nik: driverData.nik,
        phone: driverData.phone,
        alamat: driverData.alamat,
        totalViolations: 2, // Mock data
        totalRitaseMonth: ritases.length
      } as Driver,
      ritases
    };
  } catch (error) {
    console.error('Error fetching driver profile:', error);
    return null;
  }
}

export async function fetchDashboardData(selectedDate: string, driverId: string, area: string = 'JBK') {  try {
    let query = supabase
      .from('trips')
      .select(`
        *,
        drivers!inner (*)
      `)
      .eq('tanggal', selectedDate)
      .eq('driver_id', driverId);

    query = applyTripAreaQuery(query, area);

    const { data: trips, error } = await query.order('ritase_no', { ascending: true });

    if (error) throw error;

    const filteredTrips = (trips || []).filter((row: TripAreaRow) =>
      tripMatchesJournalArea(row, area)
    );

    const ritases: Ritase[] = filteredTrips.map((row: any, idx: number) => {
      const isFinished = !!row.actual_unloading;
      const isActive = !!row.actual_outpool && !isFinished;

      return {
        id: row.id || idx + 1,
        ritaseNo: row.ritase_no, 
        route: `${row.pdc_muat || '---'} → ${row.pdc_bongkar || '---'}`, 
        status: (isFinished ? 'finished' : (isActive ? 'active' : 'locked')) as any,
        type: (isFinished ? 'completed' : (isActive ? 'active' : 'locked')) as any,
        duration: calculateDuration(row.actual_in_pdc, row.actual_unloading, resolveTripJournalArea(row)),
        timeline: [
          { label: 'OUTPOOL', actual: fmtTime(row.actual_outpool) || '--:--', type: (row.actual_outpool ? 'completed' : 'pending') as any },
          { label: 'IN PDC', plan: fmtTime(row.plan_dccp) || '--:--', actual: fmtTime(row.actual_in_pdc) || '--:--', type: (row.actual_in_pdc ? 'completed' : (isActive ? 'active' : 'pending')) as any },
          { label: 'OUT PDC', actual: fmtTime(row.actual_out_pdc) || '--:--', type: (row.actual_out_pdc ? 'completed' : (row.actual_in_pdc ? 'active' : 'pending')) as any },
          { label: 'UNLOADING', plan: fmtTime(row.plan_unloading) || '--:--', actual: fmtTime(row.actual_unloading) || '--:--', type: (row.actual_unloading ? 'completed' : (row.actual_out_pdc ? 'active' : 'pending')) as any }
        ]
      };
    });

    const driverData = filteredTrips[0]?.drivers || null;

    return {
      driverDetails: driverData ? {
        id: driverData.id,
        name: driverData.name,
        status: (ritases.some(r => r.status === 'active') ? 'online' : 'offline') as 'online' | 'offline',
        avatar: driverData.avatar_url,
        noPolisi: driverData.no_polisi || filteredTrips[0]?.no_polisi,
        simExpiry: driverData.sim_expiry,
        simPhotoUrl: driverData.sim_photo_url,
        simStatus: calculateSIMStatus(driverData.sim_expiry)
      } : null,
      ritases,
      readiness: filteredTrips[0] ? {
        physicalHealth: 'OK',
        bloodPressure: 'NORMAL',
        alcoholTest: '0.00% (CLEAR)', 
        lastVerification: filteredTrips[0].actual_outpool || '--:--'
      } : null
    };
  } catch (error) {
    console.error('Error dashboard:', error);
    return { ritases: [], readiness: null, driverDetails: null };
  }
}
export async function fetchFleetMonitoringData(date: string) {
  try {
    console.log('--- START FLEET FETCH ---');
    console.log('Target Date:', date);
    
    // 1. Fetch trips for the date FIRST (only active ones)
    const { data: trips, error: tError } = await supabase
      .from('trips')
      .select(`
        *,
        drivers (
          id,
          name,
          avatar_url,
          no_polisi
        )
      `)
      .eq('tanggal', date)
      .limit(2000);
    
    if (tError) throw tError;
    
    if (!trips || trips.length === 0) {
      console.warn('No trips found for date:', date);
      return [];
    }

    console.log(`Found ${trips.length} trips for today`);

    // 2. Group trips by driver
    const driverIds = Array.from(new Set(trips.map(t => t.driver_id)));
    
    const fleet = driverIds.map(dId => {
      // Helper to parse ritase number from string like "RIT 1" or "1"
      const parseRit = (val: any) => {
        if (typeof val === 'number') return val;
        const match = String(val || '').match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      };

      const driverTrips = trips
        .filter(t => t.driver_id === dId)
        .sort((a, b) => {
          return parseRit(a.ritase_no) - parseRit(b.ritase_no);
        });
      
      const firstTrip = driverTrips[0];
      const driverInfo = firstTrip.drivers;
      
      // Helper to compare times (HH:mm)
      const isLate = (actual: string | null, plan: string | null) => {
        if (!plan || plan === '--:--') return false;
        
        // Only check delay if we are looking at TODAY or past dates
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const todayStr = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        if (date > todayStr) return false; // Don't flag future dates

        if (!actual || actual === '--:--') {
          const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          return currentStr > plan;
        }
        return actual > plan;
      };

      // Find the "current" ritase
      let currentTrip = driverTrips.find(t => !t.actual_unloading) || driverTrips[driverTrips.length - 1];
      
      let status: any = 'In Pool';
      let lastUpdate = '--:--';
      let origin = 'Pool';
      let destination = 'Plant';
      let isDelayed = false;
      let delayRitase = 0;
      let isChangeShift = false;
      let changeRitase = 0;

      // Project Categorization Logic (using 'area' column as requested)
      const tamKeywords = ['JBK', 'NGORO', 'SUMATERA'];
      const isTAM = driverTrips.some(t => {
        const area = (t.area || '').toUpperCase();
        return tamKeywords.some(key => area.includes(key));
      });
      const project = (isTAM ? 'TAM' : 'TMMIN') as 'TAM' | 'TMMIN';

      const enrichedTrips = driverTrips.map((t, index) => {
        const ritNo = index + 1;
        const shift = (t.shift || '').toUpperCase();
        const inPdc = t.actual_in_pdc || '';
        
        let isChange = false;
        if (shift.includes('DAY')) {
          isChange = inPdc > '17:00';
        } else if (shift.includes('NIGHT')) {
          // Night shift normally ends in the morning. 
          // If they are still loading (Muat) at 5 AM or later, it's a change shift.
          isChange = inPdc > '05:00' && inPdc < '12:00'; 
        }

        return {
          ...t,
          plan_dccp: fmtTime(t.plan_dccp),
          actual_in_pdc: fmtTime(t.actual_in_pdc),
          actual_outpool: fmtTime(t.actual_outpool),
          actual_out_pdc: fmtTime(t.actual_out_pdc),
          actual_unloading: fmtTime(t.actual_unloading),
          ritNo,
          isDelayed: false, // Disabled
          isChange
        };
      });

      if (currentTrip) {
        const curEnriched = enrichedTrips.find(t => t.id === currentTrip.id);
        const curRitNo = curEnriched?.ritNo || 0;
        
        origin = currentTrip.pdc_muat || 'Plant';
        destination = currentTrip.pdc_bongkar || 'Tujuan';
        
        // 1. Check for Change Shift (current status)
        if (curEnriched?.isChange) {
          isChangeShift = true;
          changeRitase = curRitNo;
        }

        // 2. Check for Potential Delay (any ritase) - Disabled
        const delayedTrip = null;

        if (currentTrip.actual_unloading) {
          status = 'At Destination';
          lastUpdate = currentTrip.actual_unloading;
          
          const nextEnriched = enrichedTrips.find(t => t.ritNo === curRitNo + 1);
          if (nextEnriched) {
            const nextTrip = driverTrips.find(t => t.id === nextEnriched.id);
            status = 'OTW PDC';
            origin = currentTrip.pdc_bongkar;
            destination = nextTrip?.pdc_muat || 'Plant';
            if (false) { // Disabled delay check
              isDelayed = true;
              delayRitase = nextEnriched.ritNo;
            }
          } else {
            status = 'Finished';
          }
        } else if (currentTrip.actual_out_pdc) {
          status = 'OTW Destination';
          lastUpdate = fmtTime(currentTrip.actual_out_pdc) || currentTrip.actual_out_pdc;
        } else if (currentTrip.actual_in_pdc) {
          status = 'In PDC';
          lastUpdate = fmtTime(currentTrip.actual_in_pdc) || currentTrip.actual_in_pdc;
        } else if (currentTrip.actual_outpool) {
          status = 'OTW PDC';
          lastUpdate = fmtTime(currentTrip.actual_outpool) || currentTrip.actual_outpool;
        }
      }

      return {
        id: dId,
        driverName: driverInfo?.name || 'Unknown Driver',
        nopol: driverInfo?.no_polisi || firstTrip.no_polisi || 'No Plat',
        currentRitase: currentTrip ? (enrichedTrips.find(t => t.id === currentTrip.id)?.ritNo || 0) : 0,
        totalRitase: driverTrips.length,
        status,
        lastUpdate,
        origin,
        destination,
        shift: firstTrip.shift || 'Unknown',
        project,
        area: (firstTrip.area || '').toUpperCase(),
        isChangeShift,
        changeRitase,
        isDelayed,
        delayRitase,
        avatar_url: driverInfo?.avatar_url,
        allTrips: enrichedTrips
      };
    });

    console.log('--- FLEET FETCH SUCCESS ---');
    return fleet;
  } catch (e) {
    console.error('CRITICAL ERROR in fetchFleetMonitoringData:', e);
    return [];
  }
}

export interface LoginStats {
  activeFleet: number;
  onTimeRate: number;
  liveTrips: number;
  totalDrivers: number;
}

export function getMonthRangeWIB(): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const start = fmt(new Date(wib.getFullYear(), wib.getMonth(), 1));
  const end = fmt(new Date(wib.getFullYear(), wib.getMonth() + 1, 0));
  return { start, end };
}

export async function fetchLoginStats(): Promise<LoginStats> {
  try {
    const { start, end } = getMonthRangeWIB();

    // Total drivers
    const { count: totalDrivers } = await supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true });

    // Month trips (broad area query, no area filter so login reflects whole fleet)
    const { data: monthTrips, error: tripsError } = await supabase
      .from('trips')
      .select('driver_id, area, actual_outpool, actual_in_pdc, actual_out_pdc, actual_unloading, plan_dccp, plan_unloading, tanggal')
      .gte('tanggal', start)
      .lte('tanggal', end);

    if (tripsError) throw tripsError;

    const trips = monthTrips || [];

    // Active fleet = unique drivers with trips this month
    const activeFleet = new Set(trips.map((t: any) => t.driver_id)).size;

    // Live trips = already outpool but not yet unloaded (current running trips)
    const liveTrips = trips.filter((t: any) =>
      !!t.actual_outpool && !t.actual_unloading
    ).length;

    // On-time rate = trips with actual_unloading present and <= plan_unloading
    const finished = trips.filter((t: any) => !!t.actual_unloading);
    const onTime = finished.filter((t: any) => {
      const plan = (t.plan_unloading || '').substring(0, 5);
      const actual = (t.actual_unloading || '').substring(0, 5);
      return plan && actual && actual <= plan;
    }).length;

    const onTimeRate = finished.length > 0
      ? Math.round((onTime / finished.length) * 1000) / 10
      : 100;

    return {
      activeFleet,
      onTimeRate,
      liveTrips,
      totalDrivers: totalDrivers || 0,
    };
  } catch (e) {
    console.error('Error fetching login stats:', e);
    return { activeFleet: 0, onTimeRate: 0, liveTrips: 0, totalDrivers: 0 };
  }
}
