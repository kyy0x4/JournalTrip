import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, Users, Award, CheckCircle2, TrendingUp,
  BarChart3, Calendar, Star, AlertTriangle, ChevronDown, User, MapPin
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell
} from 'recharts';
import { supabase } from '../lib/supabase';
import { TrainingMonthlyRecord } from '../types';

// ── Types ──────────────────────────────────────────────────────
interface DriverRow { id: string; name: string; avatar_url?: string; nik?: string; area?: string; }
interface TrainingWithDriver extends TrainingMonthlyRecord { driverName: string; driverAvatar?: string; area?: string; }

const MONTHS_ORDER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_LABELS: Record<string, string> = {
  JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'Mei', JUN: 'Jun',
  JUL: 'Jul', AUG: 'Agu', SEP: 'Sep', OCT: 'Okt', NOV: 'Nov', DEC: 'Des'
};
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1];

// ── Custom Tooltip ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 shadow-xl text-sm">
      <p className="font-black text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-semibold" style={{ color: p.fill || p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-4`}>{icon}</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

export default function TrainingDashboardPage() {
  const [year, setYear] = useState(currentYear);
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [allRecords, setAllRecords] = useState<TrainingWithDriver[]>([]);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'monthly' | 'leaderboard' | 'q1'>('monthly');

  // ── Fetch all training records with driver names ────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const [{ data: drivers }, { data: trainings }] = await Promise.all([
        supabase.from('drivers').select('id, name, avatar_url, nik, area').order('name'),
        supabase.from('driver_training_monthly').select('*'),
      ]);
      const driverMap: Record<string, DriverRow> = {};
      (drivers || []).forEach((d: DriverRow) => { driverMap[d.id] = d; });
      setTotalDrivers((drivers || []).length);
      const merged: TrainingWithDriver[] = (trainings || []).map((r: TrainingMonthlyRecord) => ({
        ...r,
        driverName: driverMap[r.driver_id]?.name || 'Driver Tidak Dikenal',
        driverAvatar: driverMap[r.driver_id]?.avatar_url,
        area: driverMap[r.driver_id]?.area,
      }));
      setAllRecords(merged);
      setIsLoading(false);
    };
    fetchAll();
  }, []);

  // ── Area options & filtered records ───────────────────────────
  const areaOptions = useMemo(() => {
    const areas = new Set<string>();
    allRecords.forEach(r => { if (r.area) areas.add(r.area); });
    return ['ALL', ...Array.from(areas).sort()];
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    if (!selectedArea || selectedArea === 'ALL') return allRecords;
    return allRecords.filter(r => r.area === selectedArea);
  }, [allRecords, selectedArea]);

  // Jumlah driver yang terlihat = total driver di area terpilih (jika filter aktif)
  const visibleTotalDrivers = useMemo(() => {
    if (!selectedArea || selectedArea === 'ALL') return totalDrivers;
    return new Set(filteredRecords.map(r => r.driver_id)).size;
  }, [selectedArea, filteredRecords, totalDrivers]);

  // ── Helper: extract year from DD/MM/YYYY or MM/DD/YYYY date string ───────────
  const getTrainingYear = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    // Support comma-separated dates (e.g. "13/01/2026, 27/01/2026") — take first
    const first = dateStr.split(',')[0].trim();
    // DD/MM/YYYY or similar — year is last segment
    const parts = first.split('/');
    if (parts.length === 3) {
      const yr = parseInt(parts[2], 10);
      return isNaN(yr) ? null : yr;
    }
    // Fallback to JS Date parsing
    const parsed = new Date(first).getFullYear();
    return isNaN(parsed) ? null : parsed;
  };

  // ── Monthly stats ──────────────────────────────────────────────
  const monthlyStats = useMemo(() => {
    return MONTHS_ORDER.map(month => {
      const monthRecs = filteredRecords.filter(r => {
        const bulan = r.bulan?.toUpperCase();
        const recYear = getTrainingYear(r.tanggal_training);
        return bulan === month && (recYear === year || recYear === null);
      });
      const uniqueDrivers = new Set(monthRecs.filter(r => r.kehadiran > 0 || r.post_test > 0).map(r => r.driver_id));
      const passing = new Set(monthRecs.filter(r => r.kelulusan === 'L').map(r => r.driver_id));
      return {
        month,
        label: MONTH_LABELS[month],
        peserta: uniqueDrivers.size,
        lulus: passing.size,
        pctPeserta: visibleTotalDrivers > 0 ? Math.round((uniqueDrivers.size / visibleTotalDrivers) * 100) : 0,
        pctLulus: uniqueDrivers.size > 0 ? Math.round((passing.size / uniqueDrivers.size) * 100) : 0,
      };
    });
  }, [filteredRecords, year, visibleTotalDrivers]);

  // ── Leaderboard ────────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const counts: Record<string, { name: string; avatar?: string; count: number; passed: number }> = {};
    filteredRecords
      .filter(r => r.kehadiran > 0 || r.post_test > 0)
      .forEach(r => {
        if (!counts[r.driver_id]) counts[r.driver_id] = { name: r.driverName, avatar: r.driverAvatar, count: 0, passed: 0 };
        counts[r.driver_id].count++;
        if (r.kelulusan === 'L') counts[r.driver_id].passed++;
      });
    return Object.entries(counts)
      .map(([id, v]) => ({ id, ...v, pctPass: v.count > 0 ? Math.round((v.passed / v.count) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredRecords]);

  // ── Q1 Compliance (rolling 3-month window) ─────────────────────
  const q1Compliance = useMemo(() => {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const relevantMonths = MONTHS_ORDER.filter((_, idx) => {
      const monthDate = new Date(year, idx, 1);
      return monthDate >= threeMonthsAgo && monthDate <= now;
    });

    const driverCounts: Record<string, { name: string; avatar?: string; count: number }> = {};
    filteredRecords
      .filter(r => relevantMonths.includes(r.bulan?.toUpperCase()) && (r.kehadiran > 0 || r.post_test > 0))
      .forEach(r => {
        if (!driverCounts[r.driver_id]) driverCounts[r.driver_id] = { name: r.driverName, avatar: r.driverAvatar, count: 0 };
        driverCounts[r.driver_id].count++;
      });

    // Build a map of all driver names from the complete allRecords list (not just 3-month active ones)
    const allDriverNames: Record<string, { name: string; avatar?: string }> = {};
    filteredRecords.forEach(r => {
      if (!allDriverNames[r.driver_id]) {
        allDriverNames[r.driver_id] = { name: r.driverName, avatar: r.driverAvatar };
      }
    });

    const allDriverIds = [...new Set(filteredRecords.map(r => r.driver_id))];
    return allDriverIds.map(id => ({
      id,
      name: allDriverNames[id]?.name || driverCounts[id]?.name || 'Driver',
      avatar: allDriverNames[id]?.avatar || driverCounts[id]?.avatar,
      count: driverCounts[id]?.count || 0,
      compliant: (driverCounts[id]?.count || 0) >= 1,
    })).sort((a, b) => b.count - a.count);
  }, [filteredRecords, year]);

  const q1Compliant = q1Compliance.filter(d => d.compliant).length;
  const q1Total = q1Compliance.length;
  const nonZeroMonths = monthlyStats.filter(m => m.peserta > 0);
  const avgMonthlyPeserta = nonZeroMonths.length > 0
    ? nonZeroMonths.reduce((s, m) => s + m.peserta, 0) / nonZeroMonths.length : 0;
  const avgMonthlyLulus = nonZeroMonths.length > 0
    ? nonZeroMonths.reduce((s, m) => s + m.pctLulus, 0) / nonZeroMonths.length : 0;

  const TABS: { key: 'monthly' | 'leaderboard' | 'q1'; label: string }[] = [
    { key: 'monthly', label: 'Per Bulan' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'q1', label: 'Kehadiran Q (3 Bln)' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* ── Header ── */}
      <div className="sticky top-4 z-40 px-4 md:px-6">
        <div className="max-w-6xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-white/60 dark:border-slate-800 px-6 h-16 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-blue-500" />
            <span className="font-black text-lg tracking-tight">Training Center</span>
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">Analytics</span>
          </div>
          <div className="relative">
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="appearance-none bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 pr-8 py-2 text-sm font-black text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8 mt-4">
        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Total Driver" value={visibleTotalDrivers} sub={selectedArea !== 'ALL' ? `Driver area ${selectedArea}` : 'Driver aktif terdaftar'} color="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard icon={<BarChart3 className="w-5 h-5 text-emerald-600" />} label="Rata-rata Peserta/Bulan" value={Math.round(avgMonthlyPeserta)} sub={`~${Math.round((avgMonthlyPeserta / (visibleTotalDrivers || 1)) * 100)}% dari total driver`} color="bg-emerald-50 dark:bg-emerald-900/20" />
          <StatCard icon={<Award className="w-5 h-5 text-amber-600" />} label="Avg. Kelulusan" value={`${Math.round(avgMonthlyLulus)}%`} sub="Dari peserta yang hadir" color="bg-amber-50 dark:bg-amber-900/20" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5 text-violet-600" />} label="Kepatuhan Q (3 Bln)" value={`${q1Compliant}/${q1Total}`} sub={q1Total > 0 ? `${Math.round((q1Compliant / q1Total) * 100)}% driver memenuhi standar` : 'Belum ada data'} color="bg-violet-50 dark:bg-violet-900/20" />
        </div>

        {/* ── Tabs & Filters ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === t.key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-sm font-black text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm w-full sm:w-48">
              {areaOptions.map(a => <option key={a} value={a}>{a === 'ALL' ? 'Semua Area' : a}</option>)}
            </select>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Tab: Per Bulan ── */}
          {activeTab === 'monthly' && (
            <motion.div key="monthly" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
                <div className="mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jumlah Driver Training</p>
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" /> Partisipasi Per Bulan
                    <span className="text-slate-400 font-normal text-sm">{year}</span>
                  </h3>
                </div>
                {isLoading ? (
                  <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#eff6ff' }} />
                        <Bar dataKey="peserta" name="Peserta" radius={[4, 4, 0, 0]} maxBarSize={24}>
                          {monthlyStats.map((_, i) => <Cell key={i} fill="#3b82f6" />)}
                        </Bar>
                        <Bar dataKey="lulus" name="Lulus" radius={[4, 4, 0, 0]} maxBarSize={24}>
                          {monthlyStats.map((_, i) => <Cell key={i} fill="#10b981" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Jumlah Peserta</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Lulus Post Test</span>
                </div>
              </div>

              {/* Monthly Table */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
                <h3 className="font-black text-base mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" /> Rincian Per Bulan
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bulan</th>
                        <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Peserta</th>
                        <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">% Hadir</th>
                        <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lulus</th>
                        <th className="text-right pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">% Lulus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyStats.map(m => (
                        <tr key={m.month} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 font-bold text-slate-900 dark:text-white">{m.label} {year}</td>
                          <td className="py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{m.peserta || '—'}</td>
                          <td className="py-3 text-right">
                            {m.peserta > 0 ? (
                              <span className={`font-black text-xs px-2 py-0.5 rounded-lg ${m.pctPeserta >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : m.pctPeserta >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>{m.pctPeserta}%</span>
                            ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{m.lulus || '—'}</td>
                          <td className="py-3 text-right">
                            {m.peserta > 0 ? (
                              <span className={`font-black text-xs px-2 py-0.5 rounded-lg ${m.pctLulus >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : m.pctLulus >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>{m.pctLulus}%</span>
                            ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Tab: Leaderboard ── */}
          {activeTab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
                <h3 className="font-black text-base mb-6 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Driver Paling Banyak Ikut Training
                </h3>
                {isLoading ? (
                  <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}</div>
                ) : leaderboard.length === 0 ? (
                  <p className="text-slate-400 text-sm italic text-center py-8">Belum ada data training</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((d, i) => (
                      <motion.div key={d.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className={`text-sm font-black w-6 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-500' : 'text-slate-300 dark:text-slate-600'}`}>{i + 1}</span>
                        {d.avatar ? (
                          <img src={d.avatar} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=e2e8f0&color=475569`; }} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm" alt={d.name} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 dark:text-white truncate">{d.name}</p>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min((d.count / (leaderboard[0]?.count || 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-blue-600 dark:text-blue-400">{d.count} <span className="text-slate-400 font-normal text-xs">sesi</span></p>
                          <p className="text-[10px] font-semibold text-emerald-500">{d.pctPass}% lulus</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Tab: Q Attendance ── */}
          {activeTab === 'q1' && (
            <motion.div key="q1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl p-5 border border-emerald-100 dark:border-emerald-900/40">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Memenuhi Standar
                  </p>
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{q1Compliant}</p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">≥1 kali dalam 3 bulan terakhir</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/20 rounded-3xl p-5 border border-rose-100 dark:border-rose-900/40">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Perlu Perhatian
                  </p>
                  <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{q1Total - q1Compliant}</p>
                  <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">Belum ikut training 3 bulan terakhir</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
                <h3 className="font-black text-base mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" /> Status Kehadiran Per Driver
                  <span className="text-slate-400 font-normal text-sm">(3 Bulan Terakhir)</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Standar: minimal 1–2 kali training dalam periode 3 bulan</p>
                {isLoading ? (
                  <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {q1Compliance.map(d => (
                      <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        {d.avatar ? (
                          <img src={d.avatar} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=e2e8f0&color=475569`; }} className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm shrink-0" alt={d.name} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <p className="flex-1 font-semibold text-sm text-slate-900 dark:text-white truncate">{d.name}</p>
                        <span className="font-black text-xs text-slate-500">{d.count}× hadir</span>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${d.compliant ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                          {d.compliant ? '✓ OK' : '✗ Kurang'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
