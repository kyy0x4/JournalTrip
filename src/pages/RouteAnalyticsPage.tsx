import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ship, MapPin, Calendar, ChevronDown, ArrowRight, TrendingUp, Filter, AlertTriangle } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { leadtimeService, LeadTimeData } from '../services/leadtimeService';

const TABS = ['SUMATERA', 'NGORO', 'SULAWESI'] as const;
type Tab = typeof TABS[number];

// ── SULAWESI: urutan titik lokasi (berangkat & pulang) ──
const SULAWESI_GO = ['Pinrang', 'Majene', 'Mamuju', 'Karrosa', 'Sarjo', 'Kebon Kopi', 'Kasimbar', 'Santigi', 'Paguat'];
const SULAWESI_RETURN = ['Paguat', 'Santigi', 'Kasimbar', 'Kebon Kopi', 'Sarjo', 'Karrosa', 'Mamuju', 'Majene', 'Pinrang'];

type Tujuan = 'ALL' | 'PALEMBANG' | 'LAMPUNG' | 'PEKANBARU';
const TUJUAN_OPTIONS: Tujuan[] = ['ALL', 'PALEMBANG', 'LAMPUNG', 'PEKANBARU'];

const TUJUAN_COLOR: Record<Tujuan, string> = {
  ALL: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
  PALEMBANG: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  LAMPUNG: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  PEKANBARU: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purpleald-300',
};
const TUJUAN_ACTIVE: Record<Tujuan, string> = {
  ALL: 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900',
  PALEMBANG: 'bg-amber-500 text-white',
  LAMPUNG: 'bg-emerald-500 text-white',
  PEKANBARU: 'bg-purple-500 text-white',
};

export default function RouteAnalyticsPage({ isTAM = false }: { isTAM?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('SUMATERA');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTujuan, setActiveTujuan] = useState<Tujuan>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<LeadTimeData[]>([]);
  const monthInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [y, m] = selectedMonth.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1).toISOString().split('T')[0];
      const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
      const records = await leadtimeService.getLeadTimes(start, end, activeTab);
      setData(records);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Parse "DD Mon YYYY HH:MM" or bare "HH:MM" → minutes since epoch (or since midnight for bare time).
  const MONTH_ID: Record<string, number> = {
    jan:0,feb:1,mar:2,apr:3,mei:4,may:4,jun:5,jul:6,agu:7,aug:7,
    sep:8,okt:9,oct:9,nov:10,des:11,dec:11
  };
  const dateTimeToMs = (s?: string): number | null => {
    if (!s || typeof s !== 'string') return null;
    const t = s.trim();
    // Format: "DD/MM/YYYY HH:MM" (SULAWESI) atau "DD/MM/YYYY HH:MM:SS"
    const dmyMatch = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (dmyMatch) {
      const [, dd, mm, yyyy, hh, mi] = dmyMatch;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi)).getTime();
    }
    // Format: "DD Mon YYYY HH:MM" or "DD Mon YYYY HH:MM:SS"
    const dtMatch = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (dtMatch) {
      const [, dd, mon, yyyy, hh, mm] = dtMatch;
      const monthIdx = MONTH_ID[mon.toLowerCase().slice(0,3)];
      if (monthIdx === undefined) return null;
      return new Date(Number(yyyy), monthIdx, Number(dd), Number(hh), Number(mm)).getTime();
    }
    // Format: bare "HH:MM" or "HH:MM:SS"
    const timeMatch = t.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const [, hh, mm] = timeMatch;
      // Return minutes-since-midnight multiplied by 60000 to stay in ms domain
      return (Number(hh) * 60 + Number(mm)) * 60_000;
    }
    return null;
  };

  const isBaretime = (s?: string) => !!(s && /^\d{1,2}:\d{2}/.test(s.trim()));

  const diffH = (a?: string, b?: string): number => {
    const fa = dateTimeToMs(a), fb = dateTimeToMs(b);
    if (fa === null || fb === null) return 0;
    let diffMs = fb - fa;
    // If both are bare HH:MM (no date), ms values are small (< 24h in ms).
    // A negative diff means crossing midnight → add 24h.
    if (isBaretime(a) && isBaretime(b) && diffMs < 0) {
      diffMs += 24 * 3_600_000;
    }
    if (diffMs < 0) return 0;
    return parseFloat((diffMs / 3_600_000).toFixed(2));
  };

  // Format decimal hours → "X jam Y menit" (e.g. 2.5 → "2 jam 30 menit")
  const fmtDur = (h: number | string): string => {
    const val = typeof h === 'string' ? parseFloat(h) : h;
    if (isNaN(val) || val <= 0) return '0 menit';
    const totalMin = Math.round(val * 60);
    const jam = Math.floor(totalMin / 60);
    const menit = totalMin % 60;
    if (jam === 0) return `${menit} menit`;
    if (menit === 0) return `${jam} jam`;
    return `${jam} jam ${menit} menit`;
  };

  // Normalize tujuan casing
  const normalizeTujuan = (t: string | undefined): Tujuan => {
    if (!t) return 'PALEMBANG';
    const upper = t.trim().toUpperCase();
    if (upper === 'LAMPUNG' || upper === 'LAMPUNG') return 'LAMPUNG';
    if (upper === 'PEKANBARU') return 'PEKANBARU';
    return 'PALEMBANG';
  };

  // Label tujuan dinamis: filter spesifik → nama kota asli; ALL → "Tujuan" (data campur)
  const tujuanLabel = activeTujuan === 'ALL' ? 'Tujuan' : activeTujuan.charAt(0) + activeTujuan.slice(1).toLowerCase();

  const filteredData = data.filter(d => {
    const tujuan = normalizeTujuan(d.checkpoints?.['TUJUAN']);
    return activeTujuan === 'ALL' || tujuan === activeTujuan;
  });

  // ── Resolve timeline absolut untuk row SUMATERA ────────────────────────────
  // Checkpoint tersimpan sebagai bare "HH:MM" tanpa tanggal. Urutkan kronologis:
  // jam turun dari checkpoint sebelumnya = lewat tengah malam → +1 hari.
  // Untuk unloading, koreksi pakai kolom "LeadTime Delivery (...)" (durasi dari
  // Out PDC) karena jeda Bakauheni→tujuan bisa lebih dari 24 jam.
  const resolveSumatraTimeline = (cp: Record<string, any>, rowDate: string): Record<string, number> => {
    const result: Record<string, number> = {};
    const rowStart = new Date(rowDate + 'T00:00:00').getTime();

    const toBareMins = (raw: any): number | null => {
      const dt = dateTimeToMs(raw);
      if (dt === null) return null;
      if (isBaretime(raw)) return dt / 60000;
      return null;
    };

    const steps = (keys: (string | null)[]) => {
      let dayOffset = 0;
      let prevMin: number | null = null;
      for (const key of keys) {
        if (!key || !cp[key]) continue;
        const raw = cp[key];
        if (isBaretime(raw)) {
          const mins = toBareMins(raw);
          if (mins === null) continue;
          if (prevMin !== null && mins < prevMin) dayOffset += 1;
          result[key] = rowStart + dayOffset * 86_400_000 + mins * 60_000;
          prevMin = mins;
        } else {
          const dt = dateTimeToMs(raw);
          if (dt === null) continue;
          result[key] = dt;
          const h = new Date(dt);
          prevMin = h.getHours() * 60 + h.getMinutes();
          dayOffset = Math.max(0, Math.floor((dt - rowStart) / 86_400_000));
        }
      }
    };

    const unloadingKeys = [
      'UNLOADING PDC (LAMPUNG,PALEMBANG,PEKANBARU)',
      'UNLOADING PDC POLYGON',
      'UNLOADING PDC',
      'UNLOADING',
      'PDC POLYGON',
      'TIBA TUJUAN',
      'SAMPAI TUJUAN',
    ];
    const unloadingKey = unloadingKeys.find(k => cp[k]) || null;

    // Pass 1: leg berangkat (sampai unloading)
    steps(['Out PDC', 'PELABUHAN MERAK', 'MASUK KAPAL', 'PELABUHAN BAKAUHENI', unloadingKey]);

    // Koreksi unloading pakai leadtime delivery (durasi dari Out PDC)
    if (unloadingKey && result['Out PDC']) {
      const ltKey = Object.keys(cp).find(k => k.startsWith('LeadTime Delivery'));
      if (ltKey) {
        const m = String(cp[ltKey]).match(/(\d+)\s*hari\s*(\d+)\s*jam\s*(\d+)\s*menit/);
        if (m) {
          const durMs = ((Number(m[1]) * 24 + Number(m[2])) * 60 + Number(m[3])) * 60_000;
          const corrected = result['Out PDC'] + durMs;
          if (corrected > (result['PELABUHAN BAKAUHENI'] || 0)) {
            result[unloadingKey] = corrected;
          }
        }
      }
    }

    // Pass 2: leg pulang, anchor di unloading (atau checkpoint terakhir yang ada)
    const anchorKey = (unloadingKey && result[unloadingKey]) ? unloadingKey
      : (result['PELABUHAN BAKAUHENI'] ? 'PELABUHAN BAKAUHENI' : 'Out PDC');
    const anchorMs = result[anchorKey];
    if (anchorMs !== undefined) {
      const anchorDate = new Date(anchorMs);
      let dayOffset = Math.max(0, Math.floor((anchorMs - rowStart) / 86_400_000));
      let prevMin = anchorDate.getHours() * 60 + anchorDate.getMinutes();
      for (const key of ['PELABUHAN BAKAUHENI (PULANG)', 'MASUK KAPAL (PULANG)', 'PELABUHAN MERAK (PULANG)', 'BACK TO POOL']) {
        if (!cp[key]) continue;
        const mins = toBareMins(cp[key]);
        if (mins === null) continue;
        if (mins < prevMin) dayOffset += 1;
        result[key] = rowStart + dayOffset * 86_400_000 + mins * 60_000;
        prevMin = mins;
      }
    }

    return result;
  };

  const chartData = (() => {
    if (activeTab !== 'SUMATERA') return [];
    return filteredData
      .filter(d => d.checkpoints?.['PELABUHAN MERAK'] && d.checkpoints?.['PELABUHAN BAKAUHENI'])
      .map(d => {
        const cp = d.checkpoints || {};
        const tujuan = normalizeTujuan(cp['TUJUAN']);
        const tl = resolveSumatraTimeline(cp, d.tanggal);

        // Segment 1: Tiba di Merak → Masuk Kapal (Nunggu Kapal Berangkat)
        const waitDepartHours = tl['MASUK KAPAL'] && tl['PELABUHAN MERAK']
          ? (tl['MASUK KAPAL'] - tl['PELABUHAN MERAK']) / 3_600_000
          : 0;

        // Segment 2: Masuk Kapal → Bakauheni (Ferry Berangkat)
        const ferryDepartHours = tl['MASUK KAPAL'] && tl['PELABUHAN BAKAUHENI']
          ? (tl['PELABUHAN BAKAUHENI'] - tl['MASUK KAPAL']) / 3_600_000
          : (tl['PELABUHAN BAKAUHENI'] && tl['PELABUHAN MERAK'] ? (tl['PELABUHAN BAKAUHENI'] - tl['PELABUHAN MERAK']) / 3_600_000 : 0);

        // Segment 3: Bakauheni → Tujuan (Delivery)
        // Try multiple checkpoint key names (data may vary)
        const unloadingKey = [
          'UNLOADING PDC (LAMPUNG,PALEMBANG,PEKANBARU)',
          'UNLOADING PDC POLYGON',
          'UNLOADING PDC',
          'UNLOADING',
          'PDC POLYGON',
          'TIBA TUJUAN',
          'SAMPAI TUJUAN',
        ].find(k => cp[k]);
        const destHours = unloadingKey && tl[unloadingKey] && tl['PELABUHAN BAKAUHENI']
          ? Math.max(0, (tl[unloadingKey] - tl['PELABUHAN BAKAUHENI']) / 3_600_000)
          : 0;

        // Segment 4: Tujuan → Pel. Bakauheni (PULANG) (Return leg starts)
        const returnToPortHours = tl['PELABUHAN BAKAUHENI (PULANG)'] && unloadingKey && tl[unloadingKey]
          ? Math.max(0, (tl['PELABUHAN BAKAUHENI (PULANG)'] - tl[unloadingKey]) / 3_600_000)
          : 0;

        // Segment 5: Pel. Bakauheni (PULANG) → Masuk Kapal (PULANG) (Nunggu Kapal Pulang)
        const waitReturnHours = tl['MASUK KAPAL (PULANG)'] && tl['PELABUHAN BAKAUHENI (PULANG)']
          ? Math.max(0, (tl['MASUK KAPAL (PULANG)'] - tl['PELABUHAN BAKAUHENI (PULANG)']) / 3_600_000)
          : 0;

        // Segment 6: Masuk Kapal (PULANG) → Pel. Merak (PULANG) (Ferry Pulang)
        const ferryReturnHours = tl['PELABUHAN MERAK (PULANG)'] && (tl['MASUK KAPAL (PULANG)'] || tl['PELABUHAN BAKAUHENI (PULANG)'])
          ? Math.max(0, (tl['PELABUHAN MERAK (PULANG)'] - (tl['MASUK KAPAL (PULANG)'] || tl['PELABUHAN BAKAUHENI (PULANG)'])) / 3_600_000)
          : 0;

        // Segment 7: Merak (PULANG) → Back to Pool
        const returnToPoolHours = tl['BACK TO POOL'] && tl['PELABUHAN MERAK (PULANG)']
          ? Math.max(0, (tl['BACK TO POOL'] - tl['PELABUHAN MERAK (PULANG)']) / 3_600_000)
          : 0;

        return {
          ...d,
          tujuan,
          waitDepartHours,
          ferryDepartHours,
          destHours,
          returnToPortHours,
          waitReturnHours,
          ferryReturnHours,
          returnToPoolHours,
          label: `${(d.driver || '?').split(' ')[0]} ${new Date(d.tanggal).getDate()}/${new Date(d.tanggal).getMonth() + 1}`
        };
      })
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  })();

  const avgOf = (key: keyof (typeof chartData)[0]) => {
    const vals = chartData.filter(d => ((d[key] as number) || 0) > 0);
    if (vals.length === 0) return 0;
    return Number((vals.reduce((s, d) => s + ((d[key] as number) || 0), 0) / vals.length).toFixed(1));
  };

  const avgWaitDepart = avgOf('waitDepartHours');
  const avgFerry = avgOf('ferryDepartHours');
  const avgDest = avgOf('destHours');
  const avgReturnToPort = avgOf('returnToPortHours');
  const avgWaitReturn = avgOf('waitReturnHours');
  const avgFerryReturn = avgOf('ferryReturnHours');
  const avgReturnPool = avgOf('returnToPoolHours');

  // ── NGORO chart data ──
  const ngoroData = useMemo(() => {
    if (activeTab !== 'NGORO') return [];
    return data
      .filter(d => d.checkpoints?.['Out PDC'])
      .map(d => {
        const cp = d.checkpoints || {};
        const diffNgoro = (a?: string, b?: string): number => {
          if (!a || !b) return 0;
          const fa = a.split(':').map(Number);
          const fb = b.split(':').map(Number);
          if (isNaN(fa[0]) || isNaN(fb[0])) return 0;
          let diff = (fb[0] * 60 + fb[1]) - (fa[0] * 60 + fa[1]);
          if (diff < 0) diff += 24 * 60; // cross midnight
          // NGORO is long-haul ~20h, clamp unreasonably large diffs
          if (diff > 20 * 60) diff -= 24 * 60;
          if (diff < 0) diff = 0;
          return parseFloat((diff / 60).toFixed(1));
        };

        // Segment A: Out PDC → KM 166 (Tol Cipularang/awal jalan)
        const segA = diffNgoro(cp['Out PDC'], cp['Actual (KM 166)']);
        // Segment B: KM 166 → KM 379A
        const segB = diffNgoro(cp['Actual (KM 166)'], cp['Actual (KM 379A)']);
        // Segment C: KM 379A → KM 575A (Menuju Surabaya)
        const segC = diffNgoro(cp['Actual (KM 379A)'], cp['Actual (KM 575A)']);
        // Segment D: KM 575A → Unloading (Masuk Ngoro)
        const segD = diffNgoro(cp['Actual (KM 575A)'], cp['Actual (Unloading)']);

        // Segment E (Pulang): Unloading → KM 575B
        const segE = diffNgoro(cp['Actual (Unloading)'], cp['Actual (575B)']);
        // Segment F (Pulang): KM 575B → KM 360B
        const segF = diffNgoro(cp['Actual (575B)'], cp['Actual (KM 360B)']);
        // Segment G (Pulang): KM 360B → KM 164B
        const segG = diffNgoro(cp['Actual (KM 360B)'], cp['Actual (KM 164B)']);
        // Segment H (Pulang): KM 164B → Back To Pool
        const segH = diffNgoro(cp['Actual (KM 164B)'], cp['Actual (Back To Pool)']);

        const totalLT = [segA, segB, segC, segD].reduce((s, x) => s + x, 0);

        return {
          ...d,
          tujuan: cp['Tujuan'] || 'MJKT',
          shift: (cp['Shift'] || '').toUpperCase().includes('DAY') ? 'DAY' : 'NIGHT',
          segA, segB, segC, segD, segE, segF, segG, segH,
          totalLT,
          label: `${(d.driver || '?').split(' ')[0]} ${new Date(d.tanggal).getDate()}/${new Date(d.tanggal).getMonth() + 1}`
        };
      })
      .filter(d => d.segA > 0 || d.segD > 0)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [data, activeTab]);

  const ngoroAvgOf = (key: keyof (typeof ngoroData)[0]) => {
    const vals = ngoroData.filter(d => ((d[key] as number) || 0) > 0);
    if (vals.length === 0) return 0;
    return Number((vals.reduce((s, d) => s + ((d[key] as number) || 0), 0) / vals.length).toFixed(1));
  };

  // ── SULAWESI data ─────────────────────────────────────────────
  const sulawesiData = useMemo(() => {
    if (activeTab !== 'SULAWESI') return [];

    const diffLoc = (a?: string, b?: string): number => {
      const fa = dateTimeToMs(a), fb = dateTimeToMs(b);
      if (fa === null || fb === null) return 0;
      let diff = (fb - fa) / 3_600_000;
      if (diff < 0) diff += 24; // lewat tengah malam
      if (diff > 20) diff -= 24; // kalau lebih dari 20 jam, kemungkinan beda hari kelebihan
      if (diff < 0) diff = 0;
      return Math.round(diff * 100) / 100;
    };

    // Key checkpoint: cari "Actual (Nama)" atau "Actual (Nama PULANG)" dari checkpoints
    const cpVal = (cp: Record<string, any>, loc: string, isReturn: boolean): string | undefined => {
      if (isReturn) {
        return cp[`Actual (${loc} PULANG)`] || cp[`Actual (${loc} PULANG )`];
      }
      return cp[`Actual (${loc})`];
    };

    return data
      .filter(d => (d.area || '').toUpperCase() === 'SULAWESI')
      .map(d => {
        const cp = d.checkpoints || {};
        // Arah berangkat: OutPool → tiap lokasi → Unloading
        const outPool = cp['Actual OutPool'] || cp['Actual'];
        const seg: Record<string, number> = {};

        let prevVal = typeof outPool === 'string' ? outPool : undefined;
        SULAWESI_GO.forEach((loc, i) => {
          const v = cpVal(cp, loc, false);
          if (prevVal !== undefined && v) {
            seg[`s${i + 1}`] = diffLoc(prevVal, v);
          }
          if (v) prevVal = v;
        });
        // s10: Paguat → Unloading
        const unloading = cp['Actual Unloading'] || cp['Actual (Unloading)'];
        if (prevVal !== undefined && typeof unloading === 'string' && unloading) {
          seg['s10'] = diffLoc(prevVal, unloading);
        }

        // Arah pulang: Unloading → lokasi (return) → BackToPool
        prevVal = typeof unloading === 'string' ? unloading : undefined;
        if (prevVal === undefined) {
          // anchor: kalau unloading kosong, mulai dari lokasi pulang pertama yang ada
          for (const loc of SULAWESI_RETURN) {
            const v = cpVal(cp, loc, true);
            if (v) { prevVal = v; break; }
          }
        }
        SULAWESI_RETURN.forEach((loc, i) => {
          const v = cpVal(cp, loc, true);
          if (prevVal !== undefined && v) {
            seg[`p${i + 1}`] = diffLoc(prevVal, v);
          }
          if (v) prevVal = v;
        });
        const backToPool = cp['Actual BackToPool'] || cp['Actual Back To Pool'];
        if (prevVal !== undefined && typeof backToPool === 'string' && backToPool) {
          seg['p10'] = diffLoc(prevVal, backToPool);
        }

        return {
          ...d,
          ...seg,
          tujuan: (cp['TUJUAN'] as string) || (cp['Tujuan'] as string) || '',
          statusLt: (cp['Status LeadTime Delivery'] as string) || (cp['STATUS'] as string) || '',
          label: `${(d.driver || '?').split(' ')[0]} ${new Date(d.tanggal).getDate()}/${new Date(d.tanggal).getMonth() + 1}`
        };
      })
      .filter(d => Object.keys(d).some(k => /^s\d+$/.test(k) && (d as any)[k] > 0) || Object.keys(d).some(k => /^p\d+$/.test(k) && (d as any)[k] > 0))
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [data, activeTab]);

  const sulawesiAvgOf = (key: string) => {
    const vals = sulawesiData.filter(d => ((d as any)[key] || 0) > 0);
    if (vals.length === 0) return 0;
    return Number((vals.reduce((s, d) => s + ((d as any)[key] || 0), 0) / vals.length).toFixed(1));
  };

  const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const nameMap: Record<string, string> = {
      waitDepartHours: 'Menunggu Antrian Kapal',
      ferryDepartHours: 'Ferry Berangkat',
      destHours: `Bakauheni → ${tujuanLabel}`,
      returnToPortHours: `${tujuanLabel} → Bakauheni`,
      waitReturnHours: 'Menunggu Antrian Kapal Pulang',
      ferryReturnHours: 'Ferry Pulang',
      returnToPoolHours: 'Merak → Pool',
      segA: 'Segmen A', segB: 'Segmen B', segC: 'Segmen C', segD: 'Segmen D',
      segE: 'Segmen E', segF: 'Segmen F', segG: 'Segmen G', segH: 'Segmen H',
    };
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xl text-sm">
        <p className="font-black text-slate-800 dark:text-white mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="font-semibold" style={{ color: p.fill }}>
            {nameMap[p.dataKey] || p.dataKey}: {fmtDur(p.value)}
          </p>
        ))}
      </div>
    );
  };

  const EmptyChart = () => (
    <div className="h-[360px] flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3">
      <Ship className="w-8 h-8" />
      <p className="text-sm font-semibold">Belum ada data</p>
    </div>
  );

  const LoadingChart = () => (
    <div className="h-[360px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
    </div>
  );

  // Chart card template
  const ChartCard = ({
    segmenLabel,
    title,
    subtitle,
    icon,
    iconColor,
    dataKey,
    avg,
    avgColor,
    thresholds,
    colorFn,
    tooltipCursor,
  }: {
    segmenLabel: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconColor: string;
    dataKey: string;
    avg: string;
    avgColor: string;
    thresholds: [number, string, string, string]; // [t1, t2, colorNormal, colorSlow, colorLate]
    colorFn: (val: number) => string;
    tooltipCursor: string;
  }) => {
    const filtered = chartData.filter(d => (d as any)[dataKey] > 0);
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{segmenLabel}</p>
            <h3 className={`font-black text-base text-slate-900 dark:text-white flex items-center gap-2`}>
              <span className={iconColor}>{icon}</span>
              {title}
              <span className="text-slate-400 font-normal text-sm">{subtitle}</span>
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
            <p className={`text-xl font-black ${avgColor}`}>{fmtDur(avg)}</p>
          </div>
        </div>
        {isLoading ? <LoadingChart /> : filtered.length > 0 ? (
          <div className="h-[340px] overflow-x-auto overflow-y-hidden custom-scrollbar">
            <div style={{ minWidth: `${Math.max(100, filtered.length * 40)}px`, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                <BarChart data={filtered} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }}
                    angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={v => `${v}j`} width={28} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: tooltipCursor }} />
                <ReferenceLine y={Number(avg)} stroke="#e2e8f0" strokeDasharray="4 3"
                  label={{ position: 'right', value: `${avg}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {filtered.map((e, i) => (
                    <Cell key={i} fill={colorFn((e as any)[dataKey])} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        ) : <EmptyChart />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* ── Top Bar ── */}
      <div className="sticky top-4 z-40 px-4 md:px-6">
        <div className="max-w-6xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-white/60 dark:border-slate-800 px-6 h-16 rounded-2xl flex items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-slate-400" />
            <span className="font-black text-lg tracking-tight">Route Analytics</span>
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">Transit</span>
          </div>

          <div className="relative">
            <button
              onClick={() => monthInputRef.current?.showPicker()}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Calendar className="w-4 h-4" />
              {monthLabel}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <input ref={monthInputRef} type="month" value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="absolute top-full right-0 opacity-0 w-0 h-0" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-fit">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.18 }}>
            {activeTab === 'SUMATERA' ? (
              <div className="space-y-6">
                {/* ── Route Path ── */}
                <div className="flex items-center flex-wrap gap-2 text-sm font-semibold text-slate-500">
                  <span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-black">Karawang</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-xl text-blue-600 dark:text-blue-400 font-black flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5" /> Merak
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-xl text-blue-600 dark:text-blue-400 font-black">Bakauheni</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl text-amber-700 dark:text-amber-400 font-black">{tujuanLabel}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl text-purple-600 dark:text-purple-400 font-black flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5" /> Bakauheni
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 font-black">Merak</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 font-black">Pool</span>
                  <span className="ml-2 text-slate-400 text-xs font-semibold">· {chartData.length} ritase</span>
                </div>

                {/* ── Filter Tujuan ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest">
                    <Filter className="w-3 h-3" /> Tujuan
                  </span>
                  {TUJUAN_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveTujuan(t)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                        activeTujuan === t ? TUJUAN_ACTIVE[t] : TUJUAN_COLOR[t]
                      }`}
                    >
                      {t === 'ALL' ? 'Semua Tujuan' : t}
                    </button>
                  ))}
                </div>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Ritase', value: chartData.length.toString(), color: 'text-slate-900 dark:text-white' },
                    { label: 'Avg. Nunggu Kapal ↑', value: fmtDur(avgWaitDepart), color: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Avg. Ferry Berangkat', value: fmtDur(avgFerry), color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Avg. Bakauheni → ' + tujuanLabel, value: fmtDur(avgDest), color: 'text-emerald-600 dark:text-emerald-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
                      <p className={`text-xl font-black ${c.color}`}>
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── BERANGKAT SECTION HEADER ── */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-blue-100 dark:bg-blue-900/30" />
                  <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-200 dark:border-blue-800">
                    <Ship className="w-3 h-3" /> Arah Berangkat
                  </span>
                  <div className="flex-1 h-px bg-blue-100 dark:bg-blue-900/30" />
                </div>

                {/* ── Chart A: Nunggu Kapal Berangkat ── */}
                {chartData.some(d => d.waitDepartHours > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-baseline justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen A</p>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="text-orange-500">⏳</span>
                          Menunggu Antrian Kapal
                          <span className="text-slate-400 font-normal text-sm">Tiba Merak → Masuk Kapal</span>
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-orange-600 dark:text-orange-400">{fmtDur(avgWaitDepart)}</p>
                      </div>
                    </div>
                    {isLoading ? <LoadingChart /> : (() => {
                      const d = chartData.filter(x => x.waitDepartHours > 0);
                      return d.length > 0 ? (
                        <div className="h-[320px] overflow-visible">
                          <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                            <BarChart data={d} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval={0} height={85} dy={8} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fff7ed' }} />
                              <ReferenceLine y={Number(avgWaitDepart)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgWaitDepart).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                              <Bar dataKey="waitDepartHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                {d.map((e, i) => <Cell key={i} fill={e.waitDepartHours > 4 ? '#f87171' : e.waitDepartHours > 2 ? '#fb923c' : '#fdba74'} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <EmptyChart />;
                    })()}
                    <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-200 inline-block" /> Cepat (&lt;2j)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" /> Lama (2–4j)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Sangat Lama (&gt;4j)</span>
                    </div>
                  </div>
                )}

                {/* ── Chart B: Ferry Crossing Berangkat ── */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                  <div className="flex items-baseline justify-between mb-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen B</p>
                      <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <Ship className="w-4 h-4 text-blue-500" />
                        Penyeberangan Ferry Berangkat
                        <span className="text-slate-400 font-normal text-sm">Merak → Bakauheni</span>
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{fmtDur(avgFerry)}</p>
                    </div>
                  </div>

                  {isLoading ? <LoadingChart /> : chartData.length > 0 ? (
                    <div className="h-[320px] overflow-visible">
                      <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval={0} height={85} dy={8} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                          <ReferenceLine y={Number(avgFerry)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgFerry).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                          <Bar dataKey="ferryDepartHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                            {chartData.map((e, i) => (
                              <Cell key={i} fill={e.ferryDepartHours > 8 ? '#f87171' : e.ferryDepartHours > 5 ? '#fbbf24' : '#60a5fa'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyChart />}

                  <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Normal (&lt;5j)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Lambat (5–8j)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Lama (&gt;8j)</span>
                  </div>
                </div>

                {/* ── Chart C: Bakauheni → Tujuan ── */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                  <div className="flex items-baseline justify-between mb-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen C</p>
                      <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-500" />
                        Bakauheni ke {tujuanLabel}
                        <span className="text-slate-400 font-normal text-sm">Bakauheni → PDC {tujuanLabel}</span>
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmtDur(avgDest)}</p>
                    </div>
                  </div>

                  {(() => {
                    const d2 = chartData.filter(d => d.destHours > 0);
                    return isLoading ? <LoadingChart /> : d2.length > 0 ? (
                      <div className="h-[320px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                        <div style={{ minWidth: `${Math.max(100, d2.length * 40)}px`, height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                            <BarChart data={d2} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdf4' }} />
                              <ReferenceLine y={Number(avgDest)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgDest).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                              <Bar dataKey="destHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                {d2.map((e, i) => (
                                  <Cell key={i} fill={e.destHours > 10 ? '#f87171' : e.destHours > 6 ? '#fbbf24' : '#34d399'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : <EmptyChart />;
                  })()}

                  <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Normal (&lt;6j)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Lambat (6–10j)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Lama (&gt;10j)</span>
                  </div>
                </div>

                {/* ── PULANG SECTION HEADER ── */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-purple-100 dark:bg-purple-900/30" />
                  <span className="text-[11px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800">
                    <Ship className="w-3 h-3" /> Arah Pulang
                  </span>
                  <div className="flex-1 h-px bg-purple-100 dark:bg-purple-900/30" />
                </div>

                {/* ── KPI Pulang ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Avg. ' + tujuanLabel + ' → Bakauheni', value: fmtDur(avgReturnToPort), color: 'text-purple-600 dark:text-purple-400' },
                    { label: 'Avg. Nunggu Kapal ↓', value: fmtDur(avgWaitReturn), color: 'text-rose-600 dark:text-rose-400' },
                    { label: 'Avg. Ferry Pulang', value: fmtDur(avgFerryReturn), color: 'text-indigo-600 dark:text-indigo-400' },
                    { label: 'Avg. Merak → Pool', value: fmtDur(avgOf('returnToPoolHours')), color: 'text-blue-600 dark:text-blue-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
                      <p className={`text-xl font-black ${c.color}`}>
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Chart D: Tujuan → Pel. Bakauheni (Pulang) ── */}
                {chartData.some(d => d.returnToPortHours > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-baseline justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen D</p>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-500" />
                          {tujuanLabel} ke Bakauheni
                          <span className="text-slate-400 font-normal text-sm">{tujuanLabel} → Pel. Bakauheni</span>
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-purple-600 dark:text-purple-400">{fmtDur(avgReturnToPort)}</p>
                      </div>
                    </div>
                    {isLoading ? <LoadingChart /> : (() => {
                      const d = chartData.filter(x => x.returnToPortHours > 0);
                      return d.length > 0 ? (
                        <div className="h-[320px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                          <div style={{ minWidth: `${Math.max(100, d.length * 40)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                              <BarChart data={d} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fdf4ff' }} />
                                <ReferenceLine y={Number(avgReturnToPort)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgReturnToPort).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                                <Bar dataKey="returnToPortHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                  {d.map((e, i) => <Cell key={i} fill={e.returnToPortHours > 10 ? '#f87171' : e.returnToPortHours > 6 ? '#c084fc' : '#a855f7'} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : <EmptyChart />;
                    })()}
                  </div>
                )}

                {/* ── Chart E: Nunggu Kapal Pulang ── */}
                {chartData.some(d => d.waitReturnHours > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-baseline justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen E</p>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="text-rose-500">⏳</span>
                          Menunggu Antrian Kapal Pulang
                          <span className="text-slate-400 font-normal text-sm">Tiba Bakauheni → Masuk Kapal Pulang</span>
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-rose-600 dark:text-rose-400">{fmtDur(avgWaitReturn)}</p>
                      </div>
                    </div>
                    {isLoading ? <LoadingChart /> : (() => {
                      const d = chartData.filter(x => x.waitReturnHours > 0);
                      return d.length > 0 ? (
                        <div className="h-[320px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                          <div style={{ minWidth: `${Math.max(100, d.length * 40)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                              <BarChart data={d} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fff1f2' }} />
                                <ReferenceLine y={Number(avgWaitReturn)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgWaitReturn).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                                <Bar dataKey="waitReturnHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                  {d.map((e, i) => <Cell key={i} fill={e.waitReturnHours > 4 ? '#f87171' : e.waitReturnHours > 2 ? '#fb7185' : '#fda4af'} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : <EmptyChart />;
                    })()}
                  </div>
                )}

                {/* ── Chart F: Ferry Pulang ── */}
                {chartData.some(d => d.ferryReturnHours > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-baseline justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen F</p>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <Ship className="w-4 h-4 text-indigo-500" />
                          Penyeberangan Ferry Pulang
                          <span className="text-slate-400 font-normal text-sm">Bakauheni → Merak</span>
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{fmtDur(avgFerryReturn)}</p>
                      </div>
                    </div>
                    {isLoading ? <LoadingChart /> : (() => {
                      const d = chartData.filter(x => x.ferryReturnHours > 0);
                      return d.length > 0 ? (
                        <div className="h-[320px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                          <div style={{ minWidth: `${Math.max(100, d.length * 40)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                              <BarChart data={d} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eef2ff' }} />
                                <ReferenceLine y={Number(avgFerryReturn)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgFerryReturn).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                                <Bar dataKey="ferryReturnHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                  {d.map((e, i) => <Cell key={i} fill={e.ferryReturnHours > 8 ? '#f87171' : e.ferryReturnHours > 5 ? '#fbbf24' : '#818cf8'} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : <EmptyChart />;
                    })()}
                    <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" /> Normal (&lt;5j)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Lambat (5–8j)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Lama (&gt;8j)</span>
                    </div>
                  </div>
                )}

                {/* ── Chart G: Merak → Pool ── */}
                {chartData.some(d => d.returnToPoolHours > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-baseline justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Segmen G</p>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          Merak ke Pool
                          <span className="text-slate-400 font-normal text-sm">Pel. Merak → Back To Pool</span>
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{fmtDur(avgOf('returnToPoolHours'))}</p>
                      </div>
                    </div>
                    {isLoading ? <LoadingChart /> : (() => {
                      const d = chartData.filter(x => x.returnToPoolHours > 0);
                      const avgG = avgOf('returnToPoolHours');
                      return d.length > 0 ? (
                        <div className="h-[320px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                          <div style={{ minWidth: `${Math.max(100, d.length * 40)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                              <BarChart data={d} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={28} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff6ff' }} />
                                <ReferenceLine y={Number(avgG)} stroke="#e2e8f0" strokeDasharray="4 3" label={{ position: 'right', value: `${Number(avgG).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                                <Bar dataKey="returnToPoolHours" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                  {d.map((e, i) => <Cell key={i} fill={e.returnToPoolHours > 5 ? '#f87171' : e.returnToPoolHours > 3 ? '#fbbf24' : '#60a5fa'} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : <EmptyChart />;
                    })()}
                    <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Normal (&lt;3j)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Lambat (3–5j)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Lama (&gt;5j)</span>
                    </div>
                  </div>
                )}

              </div>
            ) : activeTab === 'NGORO' ? (
              <div className="space-y-6">
                {/* ── NGORO Route Path ── */}
                <div className="flex items-center flex-wrap gap-2 text-sm font-semibold text-slate-500">
                  <span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-black">Karawang</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 font-black">KM 166A</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 font-black">KM 379A</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 font-black">KM 575A</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <span className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-emerald-700 dark:text-emerald-400 font-black">Unloading (MJKT)</span>
                  <span className="ml-2 text-slate-400 text-xs font-semibold">· {ngoroData.length} ritase</span>
                </div>

                {/* ── NGORO KPI Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Ritase', value: ngoroData.length.toString(), color: 'text-slate-900 dark:text-white' },
                    { label: 'Avg. KM166 → KM575A', value: fmtDur((() => { const d = ngoroData.filter(x => x.segB > 0 && x.segD > 0); return d.length > 0 ? (d.reduce((s, x) => s + x.segB + x.segC + x.segD, 0) / d.length) : 0; })()), color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Avg. Total Lead Time', value: fmtDur((() => { const d = ngoroData.filter(x => x.totalLT > 0); return d.length > 0 ? (d.reduce((s, x) => s + x.totalLT, 0) / d.length) : 0; })()), color: 'text-amber-600 dark:text-amber-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
                      <p className={`text-xl font-black ${c.color}`}>
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── BERANGKAT HEADER ── */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-emerald-100 dark:bg-emerald-900/30" />
                  <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <TrendingUp className="w-3 h-3" /> Arah Berangkat
                  </span>
                  <div className="flex-1 h-px bg-emerald-100 dark:bg-emerald-900/30" />
                </div>

                {/* ── Shared chart renderer for NGORO ── */}
                {(['segA', 'segB', 'segC', 'segD'] as const).map((seg, idx) => {
                  const segInfo: Record<string, { label: string; subtitle: string; color: (v: number) => string; cursor: string; t1: number; t2: number; avgColor: string }> = {
                    segA: { label: 'Segmen A', subtitle: 'Out PDC → KM 166A', color: (v) => v > 3 ? '#f87171' : v > 1.5 ? '#fbbf24' : '#60a5fa', cursor: '#f8fafc', t1: 1.5, t2: 3, avgColor: 'text-blue-600 dark:text-blue-400' },
                    segB: { label: 'Segmen B', subtitle: 'KM 166A → KM 379A', color: (v) => v > 5 ? '#f87171' : v > 3 ? '#fbbf24' : '#34d399', cursor: '#f0fdf4', t1: 3, t2: 5, avgColor: 'text-emerald-600 dark:text-emerald-400' },
                    segC: { label: 'Segmen C', subtitle: 'KM 379A → KM 575A', color: (v) => v > 6 ? '#f87171' : v > 4 ? '#fbbf24' : '#34d399', cursor: '#f0fdf4', t1: 4, t2: 6, avgColor: 'text-emerald-600 dark:text-emerald-400' },
                    segD: { label: 'Segmen D', subtitle: 'KM 575A → Unloading', color: (v) => v > 2 ? '#f87171' : v > 1 ? '#fbbf24' : '#a78bfa', cursor: '#f5f3ff', t1: 1, t2: 2, avgColor: 'text-violet-600 dark:text-violet-400' },
                  };
                  const info = segInfo[seg];
                  const filtered = ngoroData.filter(d => (d[seg] as number) > 0);
                  const avg = filtered.length > 0
                    ? (filtered.reduce((s, d) => s + (d[seg] as number), 0) / filtered.length).toFixed(1)
                    : '0.0';
                  if (filtered.length === 0) return null;
                  return (
                    <div key={seg} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                      <div className="flex items-baseline justify-between mb-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{info.label}</p>
                          <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            {info.subtitle}
                          </h3>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                          <p className={`text-xl font-black ${info.avgColor}`}>{fmtDur(avg)}</p>
                        </div>
                      </div>
                      {isLoading ? <LoadingChart /> : (
                        <div className="h-[300px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                          <div style={{ minWidth: `${Math.max(100, filtered.length * 40)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                              <BarChart data={filtered} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false}
                                  tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }}
                                  angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                              <YAxis axisLine={false} tickLine={false}
                                tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                                tickFormatter={v => `${v}j`} width={28} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: info.cursor }} />
                              <ReferenceLine y={Number(avg)} stroke="#e2e8f0" strokeDasharray="4 3"
                                label={{ position: 'right', value: `${avg}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                              <Bar dataKey={seg} radius={[4, 4, 0, 0]} maxBarSize={28}>
                                {filtered.map((e, i) => (
                                  <Cell key={i} fill={info.color(e[seg] as number)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: info.color(info.t1 - 0.1) }} /> Normal (&lt;{info.t1}j)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: info.color(info.t2 - 0.1) }} /> Lambat ({info.t1}–{info.t2}j)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: info.color(info.t2 + 0.1) }} /> Lama (&gt;{info.t2}j)</span>
                      </div>
                    </div>
                  );
                })}

                {/* ── PULANG HEADER ── */}
                {ngoroData.some(d => d.segE > 0 || d.segF > 0 || d.segG > 0) && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-purple-100 dark:bg-purple-900/30" />
                      <span className="text-[11px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800">
                        <TrendingUp className="w-3 h-3" /> Arah Pulang
                      </span>
                      <div className="flex-1 h-px bg-purple-100 dark:bg-purple-900/30" />
                    </div>

                    {(['segE', 'segF', 'segG', 'segH'] as const).map((seg) => {
                      const segInfo: Record<string, { label: string; subtitle: string; color: (v: number) => string; cursor: string; t1: number; t2: number; avgColor: string }> = {
                        segE: { label: 'Segmen E', subtitle: 'Unloading → KM 575B', color: (v) => v > 2 ? '#f87171' : v > 1 ? '#c084fc' : '#a855f7', cursor: '#fdf4ff', t1: 1, t2: 2, avgColor: 'text-purple-600 dark:text-purple-400' },
                        segF: { label: 'Segmen F', subtitle: 'KM 575B → KM 360B', color: (v) => v > 5 ? '#f87171' : v > 3 ? '#fbbf24' : '#818cf8', cursor: '#eef2ff', t1: 3, t2: 5, avgColor: 'text-indigo-600 dark:text-indigo-400' },
                        segG: { label: 'Segmen G', subtitle: 'KM 360B → KM 164B', color: (v) => v > 5 ? '#f87171' : v > 3 ? '#fbbf24' : '#818cf8', cursor: '#eef2ff', t1: 3, t2: 5, avgColor: 'text-indigo-600 dark:text-indigo-400' },
                        segH: { label: 'Segmen H', subtitle: 'KM 164B → Back To Pool', color: (v) => v > 4 ? '#f87171' : v > 2 ? '#fbbf24' : '#34d399', cursor: '#f0fdf4', t1: 2, t2: 4, avgColor: 'text-emerald-600 dark:text-emerald-400' },
                      };
                      const info = segInfo[seg];
                      const filtered = ngoroData.filter(d => (d[seg] as number) > 0);
                      const avg = filtered.length > 0
                        ? (filtered.reduce((s, d) => s + (d[seg] as number), 0) / filtered.length).toFixed(1)
                        : '0.0';
                      if (filtered.length === 0) return null;
                      return (
                        <div key={seg} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                          <div className="flex items-baseline justify-between mb-6">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{info.label}</p>
                              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-purple-500" />
                                {info.subtitle}
                              </h3>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Rata-rata</p>
                              <p className={`text-xl font-black ${info.avgColor}`}>{fmtDur(avg)}</p>
                            </div>
                          </div>
                          {isLoading ? <LoadingChart /> : (
                            <div className="h-[300px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                              <div style={{ minWidth: `${Math.max(100, filtered.length * 40)}px`, height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                                  <BarChart data={filtered} margin={{ top: 5, right: 30, left: -20, bottom: 5 }} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false}
                                      tick={{ fontSize: 8.5, fill: '#94a3b8', fontWeight: 600 }}
                                      angle={-45} textAnchor="end" interval="preserveStartEnd" height={85} dy={8} />
                                  <YAxis axisLine={false} tickLine={false}
                                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                                    tickFormatter={v => `${v}j`} width={28} />
                                  <Tooltip content={<CustomTooltip />} cursor={{ fill: info.cursor }} />
                                  <ReferenceLine y={Number(avg)} stroke="#e2e8f0" strokeDasharray="4 3"
                                    label={{ position: 'right', value: `${Number(avg).toFixed(1)}j`, fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                                  <Bar dataKey={seg} radius={[4, 4, 0, 0]} maxBarSize={28}>
                                    {filtered.map((e, i) => (
                                      <Cell key={i} fill={info.color(e[seg] as number)} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: info.color(info.t1 - 0.1) }} /> Normal (&lt;{info.t1}j)</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: info.color(info.t2 - 0.1) }} /> Lambat ({info.t1}–{info.t2}j)</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: info.color(info.t2 + 0.1) }} /> Lama (&gt;{info.t2}j)</span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ) : activeTab === 'SULAWESI' ? (
              <div className="space-y-6">
                {/* ── Route Path ── */}
                <div className="flex items-center flex-wrap gap-2 text-sm font-semibold text-slate-500">
                  <span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-black">Pool</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  {SULAWESI_GO.map(loc => (
                    <span key={loc}>
                      <span className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-emerald-700 dark:text-emerald-400 font-black text-xs">{loc}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 inline mx-1" />
                    </span>
                  ))}
                  <span className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl text-amber-700 dark:text-amber-400 font-black">Unloading</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  {SULAWESI_RETURN.map(loc => (
                    <span key={loc}>
                      <span className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl text-purple-600 dark:text-purple-400 font-black text-xs">{loc}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 inline mx-1" />
                    </span>
                  ))}
                  <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 font-black">Pool</span>
                </div>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Ritase', value: sulawesiData.length.toString(), color: 'text-slate-900 dark:text-white' },
                    { label: 'Area', value: 'SULAWESI', color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Avg. Berangkat (Pool→Unload)', value: fmtDur(sulawesiData.filter(d => (d as any).s10 > 0).length > 0 ? sulawesiData.filter(d => (d as any).s10 > 0).reduce((s, d) => s + (d as any).s10, 0) / sulawesiData.filter(d => (d as any).s10 > 0).length : 0), color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Avg. Pulang (Unload→Pool)', value: fmtDur(sulawesiData.filter(d => (d as any).p10 > 0).length > 0 ? sulawesiData.filter(d => (d as any).p10 > 0).reduce((s, d) => s + (d as any).p10, 0) / sulawesiData.filter(d => (d as any).p10 > 0).length : 0), color: 'text-purple-600 dark:text-purple-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
                      <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* ── Chart segmen SULAWESI (grid 2 kolom) ── */}
                {(() => {
                  // Bangun daftar semua segmen: berangkat (s1..s10) + pulang (p1..p10)
                  type SegDef = { key: string; from: string; to: string; dir: 'go' | 'back'; color: (v: number) => string; normal: string; lambat: string; lama: string; t1: number; t2: number; };
                  const segs: SegDef[] = [];

                  SULAWESI_GO.forEach((loc, i) => {
                    segs.push({
                      key: `s${i + 1}`,
                      from: i === 0 ? 'Pool' : SULAWESI_GO[i - 1],
                      to: loc,
                      dir: 'go',
                      color: (v) => v > 8 ? '#f87171' : v > 4 ? '#fbbf24' : '#34d399',
                      normal: '#34d399', lambat: '#fbbf24', lama: '#f87171',
                      t1: 4, t2: 8,
                    });
                  });
                  // s10: Paguat → Unloading (setelah 9 lokasi berangkat)
                  segs.push({
                    key: 's10',
                    from: 'Paguat',
                    to: 'Unloading',
                    dir: 'go',
                    color: (v) => v > 6 ? '#f87171' : v > 3 ? '#fbbf24' : '#f59e0b',
                    normal: '#f59e0b', lambat: '#fbbf24', lama: '#f87171',
                    t1: 3, t2: 6,
                  });
                  SULAWESI_RETURN.forEach((loc, i) => {
                    segs.push({
                      key: `p${i + 1}`,
                      from: i === 0 ? 'Unloading' : SULAWESI_RETURN[i - 1],
                      to: loc,
                      dir: 'back',
                      color: (v) => v > 8 ? '#f87171' : v > 4 ? '#fbbf24' : '#a78bfa',
                      normal: '#a78bfa', lambat: '#fbbf24', lama: '#f87171',
                      t1: 4, t2: 8,
                    });
                  });

                  const rendered = segs
                    .map(seg => {
                      const filtered = sulawesiData.filter(d => ((d as any)[seg.key] || 0) > 0);
                      if (filtered.length === 0) return null;
                      const avg = sulawesiAvgOf(seg.key);
                      const pinColor = seg.dir === 'go'
                        ? (seg.key === 's10' ? 'text-amber-500' : 'text-emerald-500')
                        : 'text-purple-500';
                      const avgColor = seg.dir === 'go'
                        ? (seg.key === 's10' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')
                        : 'text-purple-600 dark:text-purple-400';
                      return (
                        <div key={seg.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col">
                          <div className="flex items-start justify-between mb-3 gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                {seg.dir === 'go' ? 'Berangkat' : 'Pulang'} · Segmen {seg.key.slice(1)}
                              </p>
                              <h3 className="font-black text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                <MapPin className={`w-3.5 h-3.5 shrink-0 ${pinColor}`} />
                                <span className="truncate">{seg.from} → {seg.to}</span>
                              </h3>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">Rata²</p>
                              <p className={`text-lg font-black leading-tight ${avgColor}`}>{fmtDur(avg)}</p>
                            </div>
                          </div>
                          {isLoading ? <div className="h-[150px] bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" /> : (
                            <div className="h-[150px] overflow-x-auto overflow-y-hidden custom-scrollbar">
                              <div style={{ minWidth: `${Math.max(80, filtered.length * 34)}px`, height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={filtered} margin={{ top: 5, right: 10, left: -22, bottom: 0 }} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 7.5, fill: '#94a3b8', fontWeight: 600 }} angle={-45} textAnchor="end" interval="preserveStartEnd" height={50} dy={4} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${v}j`} width={30} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: seg.dir === 'go' ? '#f0fdf4' : '#f5f3ff' }} />
                                    <Bar dataKey={seg.key} radius={[3, 3, 0, 0]} maxBarSize={22}>
                                      {filtered.map((e, idx) => {
                                        const v = (e as any)[seg.key] as number;
                                        return <Cell key={idx} fill={seg.color(v)} />;
                                      })}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2.5 text-[9px] font-semibold text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: seg.normal }} /> Normal (&lt;{seg.t1}j)</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: seg.lambat }} /> Lambat</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: seg.lama }} /> Lama (&gt;{seg.t2}j)</span>
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean);

                  if (rendered.length === 0) return null;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rendered}
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
