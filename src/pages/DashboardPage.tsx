import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Truck, Activity, Leaf, Clock,
  CheckCircle, Shield, BarChart3, ArrowRight, RefreshCw, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList
} from 'recharts';
import { supabase } from '../lib/supabase';
import { fetchEcoViolations, buildMonthFiltersForRange } from '../services/ecoDataFetcher';
import { leadtimeService } from '../services/leadtimeService';
import { fetchTenkoData } from '../services/tenkoService';

interface DashboardProps {
  isTAM?: boolean;
}

const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const last7Days = () => {
  const end = new Date();
  end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
  
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // Last 7 days including today
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: '7 Hari Terakhir'
  };
};

const fmtNum = (n: number) => n.toLocaleString('id-ID');

const ECO_COLORS: Record<string, string> = {
  'Akselerasi': '#3b82f6',
  'Perlambatan': '#f59e0b',
  'Kecepatan': '#ef4444',
  'Tikungan': '#8b5cf6',
  'Lainnya': '#64748b'
};

// ── STAT CARD ────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, to }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; to: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="relative bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer group overflow-hidden"
    >
      <Link to={to} className="absolute inset-0 rounded-3xl" />
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 dark:text-slate-700 dark:group-hover:text-slate-400 transition-colors" />
      </div>
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
      {sub && <p className="text-[9px] font-bold text-slate-400 mt-1 truncate">{sub}</p>}
    </motion.div>
  );
}

// ── SECTION HEADER ───────────────────────────────────────
function SectionHeader({ icon, title, sub, to }: { icon: React.ReactNode; title: string; sub: string; to: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div>
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{sub}</p>
        </div>
      </div>
      <Link to={to} className="flex items-center gap-1 text-[9px] font-black text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 uppercase tracking-widest transition-colors group">
        Lihat <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

// ── CUSTOM TOOLTIP ───────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl p-3 text-[10px]">
      {label && <p className="font-black text-slate-500 uppercase tracking-widest mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-black text-slate-800 dark:text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── PIE LABEL RENDERER ───────────────────────────────────
const renderPieLabel = ({ percent, x, y, cx }: any) => {
  if (!percent || percent < 0.005) return null; // Hanya sembunyikan jika sangat kecil sekali
  try {
    return (
      <text
        x={Number(x)}
        y={Number(y)}
        fill="#64748b"
        textAnchor={Number(x) > Number(cx) ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={10}
        fontWeight={700}
      >
        {(percent * 100).toFixed(1)}%
      </text>
    );
  } catch {
    return null;
  }
};

// ── DASHBOARD PAGE ───────────────────────────────────────
export default function DashboardPage({ isTAM = false }: DashboardProps) {
  const period = last7Days();
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [ltData, setLtData] = useState<any[]>([]);
  const [ecoData, setEcoData] = useState<any[]>([]);
  const [tenkoSummary, setTenkoSummary] = useState<any>(null);
  const [checkinCount, setCheckinCount] = useState(0);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      // ── Build month filters for eco (same approach as EcoDrivingPage) ──
      const monthFilters = buildMonthFiltersForRange(period.start, period.end);

      const [lt, ...ecoChunks] = await Promise.all([
        leadtimeService.getLeadTimes(period.start, period.end),
        ...monthFilters.map(f => fetchEcoViolations({ monthFilter: f })),
      ]);

      // ── Client-side filter eco to last 7 days ──
      const MONTH_MAP: Record<string, number> = {
        Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11,
        Mei:4, Agu:7, Okt:9
      };
      const parseEcoDate = (str: string): Date | null => {
        // Handle both "06 Jul 26" (space) AND "06-Jul-26" (dash) formats
        const p = (str || '').trim().split(/[\s-]+/);
        if (p.length !== 3) return null;
        const day = parseInt(p[0]);
        const mon = MONTH_MAP[p[1]];
        const rawYear = parseInt(p[2]);
        if (isNaN(day) || mon === undefined || isNaN(rawYear)) return null;
        const yr = rawYear < 100 ? 2000 + rawYear : rawYear;
        return new Date(yr, mon, day);
      };
      const pStart = new Date(period.start);
      const pEnd   = new Date(period.end); pEnd.setHours(23, 59, 59, 999);

      const allEco = Array.from(
        new Map((ecoChunks as any[][]).flat().map((v: any) => [v.id, v])).values()
      );
      const eco = allEco.filter((v: any) => {
        const d = parseEcoDate(v.tanggal);
        return d && d >= pStart && d <= pEnd;
      });

      setLtData(isTAM ? lt.filter((r: any) => {
        const a = (r.area || '').toUpperCase();
        return !a.includes('SULAWESI');
      }) : lt);
      setEcoData(eco);

      const tenkoResult = await fetchTenkoData(period.start, period.end);
      setTenkoSummary(tenkoResult.summary);


      const { count } = await supabase
        .from('gatepass')
        .select('*', { count: 'exact', head: true })
        .gte('tanggal', today())
        .lte('tanggal', today());
      setCheckinCount(count ?? 0);
    } catch (e) {
      console.error('Dashboard load error', e);
    }
    setIsLoading(false);
    setLastRefresh(new Date());
  };

  useEffect(() => { loadAll(); }, []);

  // ── LeadTime stats ───────────────────────────────────
  const ltStats = useMemo(() => {
    if (!ltData.length) return { total: 0, ontime: 0, delay: 0, rate: 0, trend: [] };

    const getStageStatus = (item: any) => {
      const info = item.status_info || {};
      const find = (keys: string[]) => {
        for (const k of keys) {
          for (const key in info) {
            if (key.toLowerCase().includes(k.toLowerCase())) return (info[key] || '').toString().toLowerCase();
          }
        }
        return '';
      };
      const v = find(['evaluasi keluar pool', 'actual outpool', 'abnormalty']);
      if (v.includes('delay')) return 'delay';
      return 'ontime';
    };

    let ontime = 0, delay = 0;
    const dateMap: Record<string, { ontime: number; delay: number }> = {};

    ltData.forEach(item => {
      const st = getStageStatus(item);
      if (st === 'ontime') ontime++; else delay++;

      const date = (item.tanggal || '').slice(5, 10);
      if (!dateMap[date]) dateMap[date] = { ontime: 0, delay: 0 };
      if (st === 'ontime') dateMap[date].ontime++; else dateMap[date].delay++;
    });

    const total = ontime + delay;
    const trend = Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({ date, ...v }));

    return { total, ontime, delay, rate: total > 0 ? Math.round((ontime / total) * 100) : 0, trend };
  }, [ltData]);

  // ── Eco stats ────────────────────────────────────────
  const ecoStats = useMemo(() => {
    const typeMap: Record<string, number> = {};
    ecoData.forEach((v: any) => {
      const j = (v.jenis_peringatan || '').toLowerCase();
      let t = 'Lainnya';
      if (j.includes('akselerasi')) t = 'Akselerasi';
      else if (j.includes('perlambatan')) t = 'Perlambatan';
      else if (j.includes('kecepatan')) t = 'Kecepatan';
      else if (j.includes('tikungan')) t = 'Tikungan';
      
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    const pie = Object.entries(typeMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
    return { total: ecoData.length, pie };
  }, [ecoData]);

  // ── Tenko stats ──────────────────────────────────────
  const tenkoStats = useMemo(() => {
    if (!tenkoSummary) return { total: 0, normal: 0, abnormal: 0, rate: 0 };
    const normal = tenkoSummary.tensi?.normal ?? 0;
    const hipertensi = tenkoSummary.tensi?.hipertensi ?? 0;
    const hipotensi = tenkoSummary.tensi?.hipotensi ?? 0;
    const abnormal = hipertensi + hipotensi;
    const total = tenkoSummary.totalCheckups ?? 0;
    return {
      total,
      normal,
      abnormal,
      rate: total > 0 ? Math.round((normal / total) * 100) : 0,
    };
  }, [tenkoSummary]);

  const tenkoPie = useMemo(() => [
    { name: 'Normal', value: tenkoStats.normal, fill: '#10b981' },
    { name: 'Abnormal', value: tenkoStats.abnormal, fill: '#ef4444' },
  ], [tenkoStats]);

  const Skeleton = ({ h = 'h-48' }: { h?: string }) => (
    <div className={`w-full ${h} bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse`} />
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6 pb-20 w-full max-w-[100vw] overflow-x-hidden box-border">

      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-slate-900/60 rounded-3xl sm:rounded-4xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-slate-800 to-slate-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Dashboard</h1>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {dateStr} · {period.label}
              </p>
            </div>
          </div>
          <button
            onClick={loadAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
            <span className="text-slate-400 font-bold normal-case">
              {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Delivery On-Time" value={isLoading ? '—' : `${ltStats.rate}%`} sub={`${fmtNum(ltStats.ontime)} dari ${fmtNum(ltStats.total)} trips`} icon={<Truck className="w-5 h-5 text-blue-600" />} color="bg-blue-50 dark:bg-blue-500/10" to="/leadtime" />
        <StatCard label="Eco Violations" value={isLoading ? '—' : fmtNum(ecoStats.total)} sub={`Bulan ${period.label}`} icon={<Leaf className="w-5 h-5 text-emerald-600" />} color="bg-emerald-50 dark:bg-emerald-500/10" to="/eco" />
        <StatCard label="Tenko Normal" value={isLoading ? '—' : `${tenkoStats.rate}%`} sub={`${fmtNum(tenkoStats.normal)} / ${fmtNum(tenkoStats.total)} checkup`} icon={<Activity className="w-5 h-5 text-purple-600" />} color="bg-purple-50 dark:bg-purple-500/10" to="/tenko" />
        <StatCard label="Check-up Hari Ini" value={isLoading ? '—' : fmtNum(checkinCount)} sub="Driver terdaftar hari ini" icon={<Shield className="w-5 h-5 text-amber-600" />} color="bg-amber-50 dark:bg-amber-500/10" to="/gatepass" />
      </div>

      {/* ── MAIN ROW: LeadTime Trend + Eco Pie ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LeadTime Trend */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-4xl p-6 shadow-sm">
          <SectionHeader icon={<Clock className="w-4 h-4" />} title="LeadTime Delivery Trend" sub={`Harian · ${period.label}`} to="/leadtime" />
          {isLoading ? <Skeleton h="h-56" /> : ltStats.trend.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">Belum ada data</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ltStats.trend} margin={{ top: 5, right: 0, left: -32, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gOntime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDelay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.35} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ontime" name="OnTime" stroke="#10b981" strokeWidth={2.5} fill="url(#gOntime)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                  <Area type="monotone" dataKey="delay" name="Delay" stroke="#ef4444" strokeWidth={2.5} fill="url(#gDelay)" dot={false} activeDot={{ r: 4, fill: '#ef4444' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {!isLoading && ltStats.total > 0 && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ltStats.rate}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">{ltStats.rate}% OnTime</span>
              <span className="text-[9px] font-black text-rose-500 shrink-0">{fmtNum(ltStats.delay)} Delay</span>
            </div>
          )}
        </div>

        {/* Eco Violations Pie */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-4xl p-6 shadow-sm flex flex-col">
          <SectionHeader icon={<Leaf className="w-4 h-4" />} title="Eco Violations" sub="Per tipe pelanggaran" to="/eco" />
          {isLoading ? <Skeleton h="h-52" /> : ecoStats.total === 0 ? (
            <div className="flex-1 h-52 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">Tidak ada pelanggaran</div>
          ) : (
            <>
              <div className="flex-1 w-full" style={{ minHeight: '160px' }}>
                <ResponsiveContainer width="100%" height={165}>
                  <PieChart>
                    <Pie data={ecoStats.pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} label={renderPieLabel} labelLine={false}>
                      {ecoStats.pie.map((entry, i) => <Cell key={i} fill={ECO_COLORS[entry.name] || '#64748b'} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {ecoStats.pie.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ECO_COLORS[item.name] || '#64748b' }} />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[130px]">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-100">{fmtNum(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SECONDARY ROW: Tenko + Eco Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tenko Health */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-4xl p-6 shadow-sm flex flex-col">
          <SectionHeader icon={<Activity className="w-4 h-4" />} title="Tenko Health" sub="Status kesehatan driver" to="/tenko" />
          {isLoading ? <Skeleton h="h-48" /> : tenkoStats.total === 0 ? (
            <div className="h-48 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">Belum ada data</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tenkoPie} dataKey="value" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={4} label={renderPieLabel} labelLine={false}>
                      {tenkoPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-900 dark:text-white">{tenkoStats.rate}%</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Normal</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Normal</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{fmtNum(tenkoStats.normal)}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Abnormal</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{fmtNum(tenkoStats.abnormal)}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Checkup</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{fmtNum(tenkoStats.total)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Eco Breakdown Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-4xl p-6 shadow-sm flex flex-col">
          <SectionHeader icon={<BarChart3 className="w-4 h-4" />} title="Eco Breakdown" sub="Jumlah per tipe pelanggaran" to="/eco" />
          {isLoading ? <Skeleton h="h-48" /> : ecoStats.total === 0 ? (
            <div className="h-48 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">Tidak ada data</div>
          ) : (
            <div className="flex-1 w-full" style={{ minHeight: '200px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ecoStats.pie} margin={{ top: 5, right: 10, left: -28, bottom: 0 }} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.35} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={(v) => v.split(' ')[0]} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Pelanggaran" radius={[6, 6, 0, 0]}>
                    {ecoStats.pie.map((entry, i) => <Cell key={i} fill={ECO_COLORS[entry.name] || '#64748b'} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-4xl p-6 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Akses Cepat</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Journal Trip', sub: 'Ritase', path: '/', icon: <Truck className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: 'LeadTime', sub: 'Analytics', path: '/leadtime', icon: <Clock className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
            { label: 'Eco Driving', sub: 'Violations', path: '/eco', icon: <Leaf className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            { label: 'Tenko', sub: 'Health Check', path: '/tenko', icon: <Activity className="w-5 h-5" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
            { label: 'Gatepass', sub: 'Control Room', path: '/gatepass', icon: <Shield className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            { label: 'Carbon Neutral', sub: 'CO₂ Track', path: '/carbon', icon: <CheckCircle className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
          ].map((item) => (
            <Link key={item.path} to={item.path}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{item.label}</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
