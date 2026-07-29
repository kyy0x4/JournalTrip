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
}
