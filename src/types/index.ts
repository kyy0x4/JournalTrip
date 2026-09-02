export interface Driver {
  id: string;
  name: string;
  status: 'online' | 'offline';
  avatar: string;
  noPolisi?: string;
  simNumber?: string;

  simExpiry?: string;
  simStatus?: 'Valid' | 'Expired' | 'Warning' | '--';
  simPhotoUrl?: string;

  nik?: string;
  phone?: string;
  asisten?: string;
  alamat?: string;
  totalViolations?: number;
  totalRitaseMonth?: number;
  coaching_photo_url?: string;
}

export type DriverDetails = Driver;


export interface RitaseStep {
  label: string;
  plan?: string;
  actual: string;
  type: 'completed' | 'active' | 'pending';
  delay?: string;
}

export interface Ritase {
  id: number;
  ritaseNo: string | number;
  route: string;
  noPolisi?: string;
  pdcMuat?: string;
  tujuan?: string;
  status: 'finished' | 'active' | 'locked';
  type: 'completed' | 'active' | 'locked';
  duration: string;
  timeline: RitaseStep[];
}

export interface Readiness {
  physicalHealth: string;
  temperature?: string;
  bloodPressure: string;
  pulse?: string;
  alcoholTest: string;
  eyeCondition?: string;
  lastVerification: string;
}

export interface P2HRecord {
  id?: string;
  tanggal: string;
  driver_id: string;
  nopol: string;
  checked_by: string;
  status: 'OK' | 'NG';
  catatan?: string;
  checklist?: Record<string, 'OK' | 'NG'>;
  created_at?: string;
}

export interface TrainingMonthlyRecord {
  id: string;
  nik: string;
  driver_id: string;
  bulan: string; // 'JAN', 'FEB', dll
  tanggal_training: string | null;
  kehadiran: number;
  aktual_training: number;
  post_test: number;
  kelulusan: string | null; // 'L' / 'TL'
  score_kpi: number;
  created_at: string;
  area?: string;
  // Kolom baru format Sep 2026+
  hasil_pre_test?: string | null;
  hasil_post_test?: string | null;
  keterangan_test?: string | null;
  total_nilai?: number | null;
  q_kehadiran?: number | null;
}

export interface DriverViolationMonth {
  driver_id: string | null;
  driver_name: string;
  plat_nomor: string;
  month: string; // 'YYYY-MM'
  violation_count: number;
  coaching_count: number;
  last_violation_date?: string;
  last_coaching_date?: string;
}

export interface DriverCoachingSession {
  id: string;
  driver_id: string;
  violation_id: number;
  violation_date: string;
  coached_by: string | null;
  notes: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}
