import type { LucideIcon } from 'lucide-react';
import {
  Activity, BatteryLow, Droplets, HeartPulse, ParkingCircle, RotateCcw,
  Thermometer, TrendingDown, Wind, Wine, Zap,
} from 'lucide-react';
import type { TranslationKey, TranslationVars } from '../i18n';

// Satu sumber angka standar (leadtime + tenko + eco driving).
// Teksnya (label/desc/threshold) ada di kamus i18n — di sini cuma angka + key.

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
  labelKey: TranslationKey;
  descKey: TranslationKey;
  thresholdKey: TranslationKey;
  /** Nilai yang disuntik ke placeholder {..} di thresholdKey */
  thresholdVars?: TranslationVars;
  /** Ikon dibalik 180° (dipakai Harsh Acceleration) */
  flipIcon?: boolean;
}

export const ECO_DRIVING_STANDARDS: ParameterDef[] = [
  {
    icon: Zap,
    color: 'red',
    code: 'OverSpeed',
    labelKey: 'standar.eco.overspeed.label',
    descKey: 'standar.eco.overspeed.desc',
    thresholdKey: 'standar.eco.overspeed.threshold',
  },
  {
    icon: TrendingDown,
    color: 'blue',
    code: 'HA',
    labelKey: 'standar.eco.ha.label',
    descKey: 'standar.eco.ha.desc',
    thresholdKey: 'standar.eco.ha.threshold',
    flipIcon: true,
  },
  {
    icon: TrendingDown,
    color: 'amber',
    code: 'HB',
    labelKey: 'standar.eco.hb.label',
    descKey: 'standar.eco.hb.desc',
    thresholdKey: 'standar.eco.hb.threshold',
  },
  {
    icon: RotateCcw,
    color: 'purple',
    code: 'HC',
    labelKey: 'standar.eco.hc.label',
    descKey: 'standar.eco.hc.desc',
    thresholdKey: 'standar.eco.hc.threshold',
  },
  {
    icon: ParkingCircle,
    color: 'orange',
    code: 'IS',
    labelKey: 'standar.eco.is.label',
    descKey: 'standar.eco.is.desc',
    thresholdKey: 'standar.eco.is.threshold',
  },
  {
    icon: Wind,
    color: 'slate',
    code: 'IT',
    labelKey: 'standar.eco.it.label',
    descKey: 'standar.eco.it.desc',
    thresholdKey: 'standar.eco.it.threshold',
  },
];

export const TENKO_STANDARDS: ParameterDef[] = [
  {
    icon: HeartPulse,
    color: 'red',
    code: 'TENSI',
    labelKey: 'standar.tenko.tensi.label',
    descKey: 'standar.tenko.tensi.desc',
    thresholdKey: 'standar.tenko.tensi.threshold',
    thresholdVars: {
      sys: TENSI_STANDARD.hipertensi.sistolik,
      dia: TENSI_STANDARD.hipertensi.diastolik,
      sysLow: TENSI_STANDARD.hipotensi.sistolik,
      diaLow: TENSI_STANDARD.hipotensi.diastolik,
    },
  },
  {
    icon: Thermometer,
    color: 'orange',
    code: 'SUHU',
    labelKey: 'standar.tenko.suhu.label',
    descKey: 'standar.tenko.suhu.desc',
    thresholdKey: 'standar.tenko.suhu.threshold',
    thresholdVars: { val: SUHU_DEMAM_C },
  },
  {
    icon: Activity,
    color: 'blue',
    code: 'NADI',
    labelKey: 'standar.tenko.nadi.label',
    descKey: 'standar.tenko.nadi.desc',
    thresholdKey: 'standar.tenko.nadi.threshold',
    thresholdVars: { min: NADI_NORMAL.min, max: NADI_NORMAL.max },
  },
  {
    icon: Wine,
    color: 'purple',
    code: 'ALKOHOL',
    labelKey: 'standar.tenko.alkohol.label',
    descKey: 'standar.tenko.alkohol.desc',
    thresholdKey: 'standar.tenko.alkohol.threshold',
    thresholdVars: { val: ALKOHOL_NEGATIF },
  },
  {
    icon: Droplets,
    color: 'amber',
    code: 'SPO2',
    labelKey: 'standar.tenko.spo2.label',
    descKey: 'standar.tenko.spo2.desc',
    thresholdKey: 'standar.tenko.spo2.threshold',
    thresholdVars: { val: SPO2_MIN },
  },
  {
    icon: BatteryLow,
    color: 'emerald',
    code: 'FATIGUE',
    labelKey: 'standar.tenko.fatigue.label',
    descKey: 'standar.tenko.fatigue.desc',
    thresholdKey: 'standar.tenko.fatigue.threshold',
  },
  {
    icon: BatteryLow,
    color: 'slate',
    code: 'REST',
    labelKey: 'standar.tenko.rest.label',
    descKey: 'standar.tenko.rest.desc',
    thresholdKey: 'standar.tenko.rest.threshold',
    thresholdVars: { val: REST_CUKUP_JAM },
  },
];
