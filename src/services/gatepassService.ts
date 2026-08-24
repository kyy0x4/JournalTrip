import { supabase } from '../lib/supabase';
import { P2HRecord } from '../types';
import { TenkoRecord } from './tenkoService';

// Key untuk penyimpanan LocalStorage jika Supabase P2H table belum dibentuk
const LOCAL_P2H_KEY = 'jtrip_local_p2h_data';
const LOCAL_TENKO_KEY = 'jtrip_local_manual_tenko_data';

// Helper untuk membaca dari LocalStorage
function getLocalP2H(): P2HRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_P2H_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Helper untuk menulis ke LocalStorage
function saveLocalP2H(records: P2HRecord[]) {
  try {
    localStorage.setItem(LOCAL_P2H_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving local P2H:', e);
  }
}

// Helper untuk membaca manual Tenko dari LocalStorage
function getLocalManualTenko(): TenkoRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_TENKO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Helper untuk menulis manual Tenko ke LocalStorage
function saveLocalManualTenko(records: TenkoRecord[]) {
  try {
    localStorage.setItem(LOCAL_TENKO_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving local Tenko:', e);
  }
}

/**
 * Mengambil data P2H untuk driver spesifik pada tanggal tertentu
 */
export async function getP2HRecord(driverId: string, tanggal: string): Promise<P2HRecord | null> {
  try {
    // 1. Coba ambil dari Supabase
    const { data, error } = await supabase
      .from('p2h')
      .select('*')
      .eq('driver_id', driverId)
      .eq('tanggal', tanggal)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as P2HRecord;
    
    return null;
  } catch (dbError: any) {
    console.warn('Supabase p2h query failed, falling back to localStorage. Error:', dbError?.message || dbError);
    // 2. Fallback ke LocalStorage
    const localData = getLocalP2H();
    const found = localData.find(r => r.driver_id === driverId && r.tanggal === tanggal);
    return found || null;
  }
}

/**
 * Mengambil semua data P2H pada tanggal tertentu untuk sekumpulan driver
 */
export async function getP2HRecordsByDate(tanggal: string): Promise<P2HRecord[]> {
  try {
    const { data, error } = await supabase
      .from('p2h')
      .select('*')
      .eq('tanggal', tanggal);

    if (error) throw error;
    return (data || []) as P2HRecord[];
  } catch (dbError) {
    // Fallback ke LocalStorage
    const localData = getLocalP2H();
    return localData.filter(r => r.tanggal === tanggal);
  }
}

/**
 * Simpan/upsert P2H tanpa bergantung pada unique constraint di database.
 * Cek dulu record existing (driver_id + tanggal), lalu update atau insert.
 */
export async function upsertP2HRecord(
  record: Omit<P2HRecord, 'id' | 'created_at'> & Partial<Pick<P2HRecord, 'id' | 'created_at'>>
): Promise<{ data?: P2HRecord; error?: any }> {
  try {
    const { data: existing, error: selErr } = await supabase
      .from('p2h')
      .select('id')
      .eq('driver_id', record.driver_id)
      .eq('tanggal', record.tanggal)
      .order('created_at', { ascending: false })
      .limit(1);
    if (selErr) throw selErr;

    const payload = { ...record, created_at: new Date().toISOString() };

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('p2h')
        .update(payload)
        .eq('id', existing[0].id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return { data: (data as P2HRecord) || undefined };
    }

    const { data, error } = await supabase
      .from('p2h')
      .insert([payload])
      .select()
      .maybeSingle();
    if (error) throw error;
    return { data: (data as P2HRecord) || undefined };
  } catch (error) {
    return { error };
  }
}

/**
 * Menyimpan data P2H (OK/NG) ke database Supabase atau LocalStorage
 */
export async function saveP2HRecord(record: P2HRecord): Promise<{ success: boolean; data?: P2HRecord; error?: any }> {
  try {
    const { data, error } = await upsertP2HRecord(record);
    if (error) throw error;
    if (data) return { success: true, data };
    throw new Error('Data tidak tersimpan');
  } catch (dbError: any) {
    console.warn('Supabase p2h save failed, saving to localStorage. Error:', dbError?.message || dbError);

    // Fallback ke LocalStorage
    const localData = getLocalP2H();
    const filtered = localData.filter(r => !(r.driver_id === record.driver_id && r.tanggal === record.tanggal));

    const newRecord: P2HRecord = {
      ...record,
      id: record.id || `local-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };

    filtered.push(newRecord);
    saveLocalP2H(filtered);

    return { success: true, data: newRecord };
  }
}

export function matchResilientName(tenkoName: string | null | undefined, driverName: string | null | undefined): boolean {
  if (!tenkoName || !driverName) return false;
  
  const tNorm = tenkoName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const dNorm = driverName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (tNorm === dNorm) return true;
  
  const tWords = tenkoName.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const dWords = driverName.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  if (tWords.length === 0 || dWords.length === 0) return false;
  
  // Cocokkan kata pertama secara persis (misal "anas" dan "anas")
  if (tWords[0] === dWords[0]) {
    if (tWords.length === 1 || dWords.length === 1) return true;
    
    // Periksa inisial/singkatan kata kedua
    const tSecond = tWords[1];
    const dSecond = dWords[1];
    if (tSecond.startsWith(dSecond) || dSecond.startsWith(tSecond)) return true;
  }
  
  // Cek relasi substring
  if (tNorm.includes(dNorm) || dNorm.includes(tNorm)) return true;
  
  return false;
}

/**
 * Mengambil data Tenko Driver Hari Ini. 
 * Ini memeriksa gabungan data resmi Supabase dan data manual simulasi.
 */
export async function getTenkoForDriverToday(driverId: string, driverName: string, tanggal: string): Promise<TenkoRecord | null> {
  try {
    // 1. Coba cari di Supabase tenko
    // Kita filter berdasarkan tanggal dan nama driver (karena NIK/driver_id tenko bisa berupa nama atau id)
    const { data, error } = await supabase
      .from('tenko')
      .select('*')
      .eq('tanggal', tanggal)
      .limit(200);

    if (error) throw error;

    if (data && data.length > 0) {
      // Cari yang NIK atau nama cocok dengan resilient name matching
      const found = data.find(r => 
        r.driver_id === driverId || 
        r.nik === driverId || 
        matchResilientName(r.nama_driver, driverName)
      );
      if (found) return found as TenkoRecord;
    }
  } catch (dbError) {
    console.warn('Error querying tenko database:', dbError);
  }

  // 2. Cek apakah ada data Tenko inputan manual (simulasi)
  const localManual = getLocalManualTenko();
  const manualFound = localManual.find(r => 
    (r.driver_id === driverId || matchResilientName(r.nama_driver, driverName)) && 
    r.tanggal === tanggal
  );

  return manualFound || null;
}

/**
 * Mengambil semua data Tenko pada tanggal tertentu (untuk matching massal di halaman gatepass)
 */
export async function getTenkoRecordsByDate(tanggal: string): Promise<TenkoRecord[]> {
  try {
    const { data, error } = await supabase
      .from('tenko')
      .select('*')
      .eq('tanggal', tanggal)
      .limit(500);

    if (error) throw error;
    return (data || []) as TenkoRecord[];
  } catch (dbError) {
    console.warn('Error querying tenko database:', dbError);
    const localManual = getLocalManualTenko();
    return localManual.filter(r => r.tanggal === tanggal);
  }
}

/**
 * Menyimpan data Tenko manual/simulasi untuk demo kelolosan
 */
export async function saveManualTenkoRecord(record: Partial<TenkoRecord>): Promise<TenkoRecord> {
  const completeRecord: TenkoRecord = {
    id: record.id || `tenko-${Math.random().toString(36).substr(2, 9)}`,
    tanggal: record.tanggal || new Date().toISOString().split('T')[0],
    timestamp: record.timestamp || new Date().toLocaleTimeString('id-ID'),
    driver_id: record.driver_id || '',
    nama_driver: record.nama_driver || 'Unknown Driver',
    nopol: record.nopol || '--',
    no_lambung: record.no_lambung || '--',
    tensi: record.tensi || '120/80',
    sistolik: record.sistolik || 120,
    diastolik: record.diastolik || 80,
    denyut_nadi: record.denyut_nadi || 80,
    suhu_tubuh: record.suhu_tubuh || 36.5,
    alkohol: record.alkohol || 0,
    mata: record.mata || 'NORMAL',
    fatigue: record.fatigue || 'NORMAL',
    oxygen_saturation: record.oxygen_saturation || 98,
    rest_time: record.rest_time || 8,
    customer: record.customer || 'ALL',
    area: record.area || 'ALL',
    nik: record.nik || '',
    is_assistant: record.is_assistant || false,
    tensi_faktor: record.tensi_faktor || null,
    tensi_keterangan: record.tensi_keterangan || null,
  };

  // Kita simpan ke LocalStorage sebagai entitas terpisah agar tidak menimpa data real Supabase
  const localData = getLocalManualTenko();
  const filtered = localData.filter(r => !(r.driver_id === completeRecord.driver_id && r.tanggal === completeRecord.tanggal));
  filtered.push(completeRecord);
  saveLocalManualTenko(filtered);

  return completeRecord;
}
