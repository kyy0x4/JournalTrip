import type { LucideIcon } from 'lucide-react';
import {
  Activity, BatteryLow, Droplets, HeartPulse, ParkingCircle, RotateCcw,
  Thermometer, TrendingDown, Wind, Wine, Zap,
} from 'lucide-react';

// Satu sumber angka standar (leadtime + tenko + eco driving).
// Dipakai halaman /standar-parameter, LeadTimePage, TenkoPage, dan P2H & Gatepass.

export const TENSI_STANDARD = {
  hipertensi: { sistolik: 160, diastolik: 100 },
  hipotensi: { sistolik: 90, diastolik: 60 },
};

export const SUHU_DEMAM_C = 37.5;
export const NADI_NORMAL = { min: 60, max: 100 };
export const REST_CUKUP_JAM = 6;
export const ALKOHOL_NEGATIF = 0;
export const SPO2_MIN = 95;

// Standar LeadTime (jam) per tujuan di area SUMATERA
export const SUMATERA_THRESHOLDS: Record<string, number> = {
  LAMPUNG: 24,
  PALEMBANG: 36,
  PEKANBARU: 72,
};

export interface ParameterDef {
  icon: LucideIcon;
  color: string;
  code: string;
  label: string;
  desc: string;
  threshold: string;
  /** Ikon dibalik 180° (dipakai Harsh Acceleration) */
  flipIcon?: boolean;
}

export const ECO_DRIVING_STANDARDS: ParameterDef[] = [
  {
    icon: Zap,
    color: 'red',
    code: 'OverSpeed',
    label: 'Over Speed',
    desc: 'Kecepatan Melebihi 80 KM/jam',
    threshold: '> 80 km/jam',
  },
  {
    icon: TrendingDown,
    color: 'blue',
    code: 'HA',
    label: 'Harsh Acceleration',
    desc: 'Kenaikan Kecepatan 2.5 m/s atau 10 km/jam dalam 1 detik',
    threshold: '≥ 2.5 m/s² dalam 1 detik',
    flipIcon: true,
  },
  {
    icon: TrendingDown,
    color: 'amber',
    code: 'HB',
    label: 'Harsh Braking',
    desc: 'Penurunan Kecepatan 2.5 m/s atau 10 km/jam dalam 1 detik',
    threshold: '≥ 2.5 m/s² dalam 1 detik',
  },
  {
    icon: RotateCcw,
    color: 'purple',
    code: 'HC',
    label: 'Hot Cornering',
    desc: 'Bila kendaraan berbelok lebih dari 20 derajat dalam 1 detik',
    threshold: '> 20° dalam 1 detik',
  },
  {
    icon: ParkingCircle,
    color: 'orange',
    code: 'IS',
    label: 'Illegal Stop',
    desc: 'Berhenti lebih dari 15 menit di tempat yang bukan Rest Point',
    threshold: '> 15 menit di non-RP',
  },
  {
    icon: Wind,
    color: 'slate',
    code: 'IT',
    label: 'Idle Time',
    desc: 'Mesin menyala lebih dari 30 menit tanpa pergerakan',
    threshold: '> 30 menit tanpa gerak',
  },
];

export const TENKO_STANDARDS: ParameterDef[] = [
  {
    icon: HeartPulse,
    color: 'red',
    code: 'TENSI',
    label: 'Tensi Darah',
    desc: 'Ambang klasifikasi tekanan darah hasil tenko driver',
    threshold:
      `≥ ${TENSI_STANDARD.hipertensi.sistolik}/${TENSI_STANDARD.hipertensi.diastolik} Hipertensi · ` +
      `< ${TENSI_STANDARD.hipotensi.sistolik}/${TENSI_STANDARD.hipotensi.diastolik} Hipotensi`,
  },
  {
    icon: Thermometer,
    color: 'orange',
    code: 'SUHU',
    label: 'Suhu Tubuh',
    desc: 'Suhu tubuh di atas ambang dianggap demam',
    threshold: `≥ ${SUHU_DEMAM_C}°C Demam`,
  },
  {
    icon: Activity,
    color: 'blue',
    code: 'NADI',
    label: 'Denyut Nadi',
    desc: 'Rentang denyut nadi per menit yang dianggap normal',
    threshold: `${NADI_NORMAL.min}–${NADI_NORMAL.max} BPM Normal`,
  },
  {
    icon: Wine,
    color: 'purple',
    code: 'ALKOHOL',
    label: 'Alkohol',
    desc: 'Hasil tes alkohol sebelum driver berangkat',
    threshold: `${ALKOHOL_NEGATIF} = Negatif`,
  },
  {
    icon: Droplets,
    color: 'amber',
    code: 'SPO2',
    label: 'Saturasi Oksigen',
    desc: 'Kadar oksigen darah minimum driver',
    threshold: `< ${SPO2_MIN}% Rendah`,
  },
  {
    icon: BatteryLow,
    color: 'emerald',
    code: 'FATIGUE',
    label: 'Tingkat Kelelahan',
    desc: 'Kondisi fatigue driver saat pemeriksaan',
    threshold: 'LELAH = Tidak Fit',
  },
  {
    icon: BatteryLow,
    color: 'slate',
    code: 'REST',
    label: 'Waktu Tidur',
    desc: 'Durasi istirahat driver sebelum shift',
    threshold: `< ${REST_CUKUP_JAM} Jam Kurang`,
  },
];
