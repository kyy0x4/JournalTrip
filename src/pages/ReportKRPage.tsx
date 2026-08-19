import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck, Calendar, ChevronLeft, ChevronRight,
  Download, X, FileText, Search, Loader2, ShieldAlert, HardHat,
  AlertTriangle, TrendingUp, CheckCircle2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import {
  fetchKRReports, summarizeKR, buildDailyTrend, KRReportRow, KRSummaryRow,
  countBrokenSOP, countAPDNG, countIncident
} from '../services/krReportService';
import { exportToCSV } from '../services/driverAnalyticsService';

const CHART_COLORS = {
  broken_sop: '#ef4444',
  apd_ng: '#f59e0b',
  incident: '#8b5cf6',
};

export default function ReportKRPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [rows, setRows] = useState<KRReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [detailKR, setDetailKR] = useState<KRSummaryRow | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchKRReports(selectedMonth);
      setRows(data);
    } catch (e) {
      console.error(e);
      setRows([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  useEscapeKey(() => setDetailKR(null), !!detailKR);

  // ── Agregasi ──
  const summary = useMemo(() => summarizeKR(rows), [rows]);
  const trend = useMemo(() => buildDailyTrend(rows, selectedMonth), [rows, selectedMonth]);

  const totals = useMemo(() => ({
    krCount: summary.length,
    reports: summary.reduce((a, s) => a + s.report_count, 0),
    brokenSop: summary.reduce((a, s) => a + s.broken_sop, 0),
    apdNg: summary.reduce((a, s) => a + s.apd_ng, 0),
    incident: summary.reduce((a, s) => a + s.incident, 0),
  }), [summary]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter(s => s.nama_kr.toLowerCase().includes(q));
  }, [summary, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedData = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage]
  );

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // ── Data detail: laporan milik satu KR ──
  const detailReports = useMemo(() => {
    if (!detailKR) return [];
    return rows
      .filter(r => (r.nama_kr || '').trim() === detailKR.nama_kr)
      .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  }, [detailKR, rows]);

  const openDetail = (kr: KRSummaryRow) => setDetailKR(kr);

  const exportCSV = () => {
    if (summary.length === 0) {
      showToast('error', 'Tidak ada data untuk diexport.');
      return;
    }
    const rowsData = summary.map(s => ({
      'Nama KR': s.nama_kr,
      'Total Laporan': s.report_count,
      'Broken SOP': s.broken_sop,
      'APD NG': s.apd_ng,
      'Incident': s.incident,
    }));
    exportToCSV(rowsData, `Report_KR_${selectedMonth}.csv`);
    showToast('success', `CSV berhasil diexport (${rowsData.length} KR)`);
  };

  const StatCard = ({ label, value, sub, icon, color }: {
    label: string; value: string | number; sub: string; icon: React.ReactNode; color: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="relative bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
      {sub && <p className="text-[9px] font-bold text-slate-400 mt-1 truncate">{sub}</p>}
    </motion.div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* ── HEADER & FILTERS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-4xl p-4 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6 md:w-7 md:h-7 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Report KR</h1>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Broken SOP • APD • Incident</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative group w-full sm:w-44">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Calendar className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-red-500/50 outline-none uppercase tracking-widest transition-all cursor-pointer shadow-sm select-none"
              />
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm shrink-0"
              title="Muat ulang data"
            >
              <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Memuat Data Report KR...</p>
        </div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="space-y-6"
        >
          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Laporan"
              value={totals.reports.toLocaleString('id-ID')}
              sub={monthLabel}
              icon={<ClipboardCheck className="w-5 h-5 text-rose-600" />}
              color="bg-rose-50 dark:bg-rose-500/10"
            />
            <StatCard
              label="Jumlah KR"
              value={totals.krCount.toLocaleString('id-ID')}
              sub="KR melapor bulan ini"
              icon={<UsersIcon className="w-5 h-5 text-violet-600" />}
              color="bg-violet-50 dark:bg-violet-500/10"
            />
            <StatCard
              label="Broken SOP"
              value={totals.brokenSop.toLocaleString('id-ID')}
              sub="Temuan NG loading position"
              icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
              color="bg-rose-50 dark:bg-rose-500/10"
            />
            <StatCard
              label="APD NG"
              value={totals.apdNg.toLocaleString('id-ID')}
              sub="Pelanggaran APD"
              icon={<HardHat className="w-5 h-5 text-amber-600" />}
              color="bg-amber-50 dark:bg-amber-500/10"
            />
            <StatCard
              label="Incident"
              value={totals.incident.toLocaleString('id-ID')}
              sub="Kejadian incident"
              icon={<AlertTriangle className="w-5 h-5 text-violet-600" />}
              color="bg-violet-50 dark:bg-violet-500/10"
            />
          </div>

          {/* ── CHARTS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Trend */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Tren Harian</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Broken SOP • APD • Incident</p>
                </div>
              </div>
              <div className="h-96 w-full focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none" style={{ outline: 'none' }}>
                <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
                  <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.broken_sop} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLORS.broken_sop} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradApd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.apd_ng} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLORS.apd_ng} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.incident} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLORS.incident} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                      tickFormatter={(val) => {
                        const d = new Date(val + 'T00:00:00');
                        return isNaN(d.getTime()) ? val : d.getDate().toString();
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: '#e2e8f0', strokeDasharray: '3 3' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const d = new Date(String(label) + 'T00:00:00');
                          const dayLabel = isNaN(d.getTime()) ? String(label) : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                          return (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">{dayLabel}</p>
                              {payload.map((entry, index) => (
                                Number(entry.value) > 0 && (
                                  <div key={index} className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{entry.name}: {entry.value}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{value}</span>
                      )}
                      iconType="circle"
                    />
                    <Area type="monotone" dataKey="broken_sop" name="Broken SOP" stroke={CHART_COLORS.broken_sop} strokeWidth={2.5} fill="url(#gradSop)" />
                    <Area type="monotone" dataKey="apd_ng" name="APD NG" stroke={CHART_COLORS.apd_ng} strokeWidth={2.5} fill="url(#gradApd)" />
                    <Area type="monotone" dataKey="incident" name="Incident" stroke={CHART_COLORS.incident} strokeWidth={2.5} fill="url(#gradInc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar per KR */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                  <BarChart3Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Per KR</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{monthLabel}</p>
                </div>
              </div>
              <div className="h-96 w-full focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none" style={{ outline: 'none' }}>
                <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
                  <BarChart
                    data={summary.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.3} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nama_kr"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                      width={110}
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">{label}</p>
                              {payload.map((entry, index) => (
                                Number(entry.value) > 0 && (
                                  <div key={index} className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{entry.name}: {entry.value}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{value}</span>
                      )}
                      iconType="circle"
                    />
                    <Bar dataKey="broken_sop" name="Broken SOP" stackId="kr" fill={CHART_COLORS.broken_sop} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="apd_ng" name="APD NG" stackId="kr" fill={CHART_COLORS.apd_ng} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="incident" name="Incident" stackId="kr" fill={CHART_COLORS.incident} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── TABLE ── */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Rekap Per KR</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{monthLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama KR..."
                    value={searchQuery}
                    onChange={e => { setPage(1); setSearchQuery(e.target.value); }}
                    className="w-full sm:w-48 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-400/40 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-3.5 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Nama KR</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Laporan</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Broken SOP</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">APD NG</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Incident</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pagedData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          Belum ada data report KR untuk {monthLabel}
                        </p>
                      </td>
                    </tr>
                  )}
                  {pagedData.map(kr => (
                    <tr key={kr.nama_kr} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0">
                            <UsersIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white">{kr.nama_kr}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{kr.report_count} laporan</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {kr.report_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          kr.broken_sop > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                        }`}>
                          {kr.broken_sop}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          kr.apd_ng > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                        }`}>
                          {kr.apd_ng}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          kr.incident > 0 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                        }`}>
                          {kr.incident}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDetail(kr)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            title="Lihat detail laporan"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 py-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black text-slate-400">
                  {safePage} / {totalPages}
                </span>
                <button
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── DETAIL MODAL ── */}
      {createPortal(
        <AnimatePresence>
          {detailKR && (
            <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDetailKR(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800 flex flex-col"
              >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                      <ClipboardCheck className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">{detailKR.nama_kr}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {detailKR.report_count} laporan • {monthLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailKR(null)}
                    className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary pills */}
                <div className="grid grid-cols-3 gap-3 px-6 md:px-8 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-rose-600">{detailKR.broken_sop}</p>
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Broken SOP</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-amber-600">{detailKR.apd_ng}</p>
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">APD NG</p>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-violet-600">{detailKR.incident}</p>
                    <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Incident</p>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5 text-rose-400" />
                    Daftar Laporan ({detailReports.length})
                  </h4>
                  {detailReports.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tidak ada laporan bulan ini</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                      <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {detailReports.map(r => {
                          const sop = countBrokenSOP(r);
                          const apd = countAPDNG(r);
                          const inc = countIncident(r);
                          return (
                            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {r.tanggal || '-'}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold truncate">
                                  {[r.area_loading, r.no_lambung, r.nama_driver].filter(Boolean).join(' • ') || 'Detail tidak tersedia'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                  sop > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                                }`}>
                                  <ShieldAlert className="w-3 h-3" /> SOP {sop}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                  apd > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                                }`}>
                                  <HardHat className="w-3 h-3" /> APD {apd}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                  inc > 0 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                                }`}>
                                  <AlertTriangle className="w-3 h-3" /> INC {inc}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md"
          >
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-200 dark:border-rose-800'
            }`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0 ml-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Icons (avoid name clash with lucide)
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BarChart3Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="3" x2="21" y1="5" y2="5" />
      <line x1="3" x2="21" y1="19" y2="19" />
    </svg>
  );
}