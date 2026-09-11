import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Search, Loader2, Package, Users, Hash, MapPin, X, FileText, AlertTriangle, TrendingUp,
  Building2, Gauge, Navigation, Trophy,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  fetchKRLoadingUnits, summarizeByKR, summarizeByTujuan, buildDailyTrend, buildMuatDistribution,
  countRangkaFilled, KRLoadingRow, parseKRLoadingDate, isDummyRow,
} from '../services/krLoadingService';
import { exportToCSV } from '../services/driverAnalyticsService';

const COLORS = {
  units: '#0ea5e9',
  loading: '#6366f1',
  tujuan: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
  muat: '#14b8a6',
};

function StatCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex items-start justify-between mb-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div></div>
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
      {sub && <p className="text-[9px] font-bold text-slate-400 mt-1 truncate">{sub}</p>}
    </div>
  );
}

export default function KRLoadingUnitsPage({ isTAM: _isTAM = false }: { isTAM?: boolean }) {
  void _isTAM;
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [selectedPDC, setSelectedPDC] = useState('ALL');
  const [selectedTujuan, setSelectedTujuan] = useState('ALL');
  const [selectedKR, setSelectedKR] = useState('ALL');
  const [rows, setRows] = useState<KRLoadingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [detailRow, setDetailRow] = useState<KRLoadingRow | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const [pdcOpen, setPdcOpen] = useState(false);
  const [tujuanOpen, setTujuanOpen] = useState(false);
  const [krOpen, setKrOpen] = useState(false);
  const [pdcPos, setPdcPos] = useState({ top: 0, left: 0, width: 0 });
  const [tujuanPos, setTujuanPos] = useState({ top: 0, left: 0, width: 0 });
  const [krPos, setKrPos] = useState({ top: 0, left: 0, width: 0 });
  const pdcBtnRef = useRef<HTMLButtonElement>(null);
  const tujuanBtnRef = useRef<HTMLButtonElement>(null);
  const krBtnRef = useRef<HTMLButtonElement>(null);
  const pdcDropRef = useRef<HTMLDivElement>(null);
  const tujuanDropRef = useRef<HTMLDivElement>(null);
  const krDropRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchKRLoadingUnits(selectedMonth, { pdc: selectedPDC, tujuan: selectedTujuan, nama_kr: selectedKR });
      setRows(data);
    } catch (e) {
      console.error(e);
      setRows([]);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedMonth, selectedPDC, selectedTujuan, selectedKR]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pdcOpen && pdcDropRef.current && !pdcDropRef.current.contains(t) && pdcBtnRef.current && !pdcBtnRef.current.contains(t)) setPdcOpen(false);
      if (tujuanOpen && tujuanDropRef.current && !tujuanDropRef.current.contains(t) && tujuanBtnRef.current && !tujuanBtnRef.current.contains(t)) setTujuanOpen(false);
      if (krOpen && krDropRef.current && !krDropRef.current.contains(t) && krBtnRef.current && !krBtnRef.current.contains(t)) setKrOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pdcOpen, tujuanOpen, krOpen]);

  useEscapeKey(() => setDetailRow(null), !!detailRow);

  const uniquePDC = useMemo(() => { const s = new Set<string>(); rows.forEach(r => { if (r.pdc_muat) s.add(r.pdc_muat.trim()); }); return Array.from(s).sort(); }, [rows]);
  const uniqueTujuan = useMemo(() => { const s = new Set<string>(); rows.forEach(r => { if (r.tujuan_pengiriman) s.add(r.tujuan_pengiriman.trim()); }); return Array.from(s).sort(); }, [rows]);
  const uniqueKR = useMemo(() => { const s = new Set<string>(); rows.forEach(r => { if (r.nama_kr) s.add(r.nama_kr.trim()); }); return Array.from(s).sort(); }, [rows]);

  const summaryByKR = useMemo(() => summarizeByKR(rows), [rows]);
  const summaryByTujuan = useMemo(() => summarizeByTujuan(rows), [rows]);
  const trend = useMemo(() => buildDailyTrend(rows, selectedMonth), [rows, selectedMonth]);
  const muatDist = useMemo(() => buildMuatDistribution(rows), [rows]);
  const isDummy = useMemo(() => rows.length > 0 && rows.every(isDummyRow), [rows]);

  const totals = useMemo(() => {
    const totalMuat = rows.reduce((a, r) => a + Number(r.total_muat || 0), 0);
    const tujuanCount = new Set(rows.map(r => (r.tujuan_pengiriman || '').trim().toUpperCase()).filter(Boolean)).size;
    const fullLoads = rows.filter(r => Number(r.total_muat) === 6).length;
    return {
      totalMuat,
      loadingCount: rows.length,
      avgMuat: rows.length ? Math.round((totalMuat / rows.length) * 10) / 10 : 0,
      krCount: summaryByKR.length,
      tujuanCount,
      fullLoads,
    };
  }, [rows, summaryByKR]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.nama_kr || '').toLowerCase().includes(q) ||
      (r.no_lambung || '').toLowerCase().includes(q) ||
      (r.nama_driver || '').toLowerCase().includes(q) ||
      (r.tujuan_pengiriman || '').toLowerCase().includes(q) ||
      (r.pdc_muat || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = parseKRLoadingDate(a.tanggal_muat) || a.tanggal_muat_date || '';
      const db = parseKRLoadingDate(b.tanggal_muat) || b.tanggal_muat_date || '';
      if (db !== da) return db.localeCompare(da);
      return String(b.jam_muat || '').localeCompare(String(a.jam_muat || ''));
    });
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedData = useMemo(() => sortedFiltered.slice((safePage - 1) * perPage, safePage * perPage), [sortedFiltered, safePage]);

  const exportCSV = () => {
    if (sortedFiltered.length === 0) { showToast('error', 'Tidak ada data untuk diexport.'); return; }
    const csv = sortedFiltered.map(r => ({
      'Timestamp': r.entry_timestamp ? new Date(r.entry_timestamp).toLocaleString('id-ID') : '-',
      'Nama KR': r.nama_kr,
      'PDC Muat': r.pdc_muat || '-',
      'Tanggal Muat': r.tanggal_muat,
      'Jam Muat': r.jam_muat || '-',
      'No Lambung': r.no_lambung || '-',
      'Driver': r.nama_driver || '-',
      'Total Muat': r.total_muat ?? 0,
      'No Rangka 1': r.no_rangka_1 || '-',
      'No Rangka 2': r.no_rangka_2 || '-',
      'No Rangka 3': r.no_rangka_3 || '-',
      'No Rangka 4': r.no_rangka_4 || '-',
      'No Rangka 5': r.no_rangka_5 || '-',
      'No Rangka 6': r.no_rangka_6 || '-',
      'Tujuan': r.tujuan_pengiriman || '-',
    }));
    exportToCSV(csv, `KR_Loading_${selectedMonth}.csv`);
    showToast('success', `CSV berhasil diexport (${csv.length} baris)`);
  };

  const openPdc = () => { if (pdcBtnRef.current) { const r = pdcBtnRef.current.getBoundingClientRect(); const isMob = window.innerWidth < 640; setPdcPos({ top: r.bottom + 8, left: isMob ? Math.max(8, r.left) : r.left, width: Math.max(r.width, isMob ? window.innerWidth - 16 : 160) }); } setPdcOpen(v => !v); };
  const openTujuan = () => { if (tujuanBtnRef.current) { const r = tujuanBtnRef.current.getBoundingClientRect(); const isMob = window.innerWidth < 640; setTujuanPos({ top: r.bottom + 8, left: isMob ? Math.max(8, r.left) : r.left, width: Math.max(r.width, isMob ? window.innerWidth - 16 : 180) }); } setTujuanOpen(v => !v); };
  const openKr = () => { if (krBtnRef.current) { const r = krBtnRef.current.getBoundingClientRect(); const isMob = window.innerWidth < 640; setKrPos({ top: r.bottom + 8, left: isMob ? Math.max(8, r.left) : r.left, width: Math.max(r.width, isMob ? window.innerWidth - 16 : 180) }); } setKrOpen(v => !v); };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-4xl p-4 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 md:w-7 md:h-7 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">KR Loading</h1>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Monitoring unit</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative group w-full sm:w-44">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><Calendar className="w-4 h-4 text-slate-400 group-hover:text-sky-500 transition-colors" /></div>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-sky-500/50 outline-none uppercase tracking-widest transition-all cursor-pointer shadow-sm select-none" />
            </div>
            <div className="relative w-full sm:w-40">
              <button ref={pdcBtnRef} onClick={openPdc} className="w-full flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm">
                <span className="truncate flex items-center gap-1.5"><Building2 className="w-3 h-3 text-slate-400" /> {selectedPDC === 'ALL' ? 'Semua PDC' : selectedPDC}</span><ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>
              {pdcOpen && createPortal(<div className="fixed inset-0 z-11000 pointer-events-none"><AnimatePresence><motion.div ref={pdcDropRef} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} style={{ position: 'fixed', top: pdcPos.top, left: pdcPos.left, width: pdcPos.width, maxWidth: 320 }} className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1 max-h-64 overflow-y-auto">
                <button onClick={() => { setSelectedPDC('ALL'); setPdcOpen(false); setPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest ${selectedPDC === 'ALL' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Semua PDC</button>
                {uniquePDC.map(v => (<button key={v} onClick={() => { setSelectedPDC(v); setPdcOpen(false); setPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest ${selectedPDC === v ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{v}</button>))}
              </motion.div></AnimatePresence></div>, document.body)}
            </div>
            <div className="relative w-full sm:w-40">
              <button ref={tujuanBtnRef} onClick={openTujuan} className="w-full flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm">
                <span className="truncate flex items-center gap-1.5"><Navigation className="w-3 h-3 text-slate-400" /> {selectedTujuan === 'ALL' ? 'Semua Tujuan' : selectedTujuan}</span><ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>
              {tujuanOpen && createPortal(<div className="fixed inset-0 z-11000 pointer-events-none"><AnimatePresence><motion.div ref={tujuanDropRef} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} style={{ position: 'fixed', top: tujuanPos.top, left: tujuanPos.left, width: tujuanPos.width, maxWidth: 320 }} className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1 max-h-64 overflow-y-auto">
                <button onClick={() => { setSelectedTujuan('ALL'); setTujuanOpen(false); setPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest ${selectedTujuan === 'ALL' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Semua Tujuan</button>
                {uniqueTujuan.map(v => (<button key={v} onClick={() => { setSelectedTujuan(v); setTujuanOpen(false); setPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest ${selectedTujuan === v ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{v}</button>))}
              </motion.div></AnimatePresence></div>, document.body)}
            </div>
            <div className="relative w-full sm:w-40">
              <button ref={krBtnRef} onClick={openKr} className="w-full flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm">
                <span className="truncate flex items-center gap-1.5"><Users className="w-3 h-3 text-slate-400" /> {selectedKR === 'ALL' ? 'Semua KR' : selectedKR}</span><ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>
              {krOpen && createPortal(<div className="fixed inset-0 z-11000 pointer-events-none"><AnimatePresence><motion.div ref={krDropRef} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} style={{ position: 'fixed', top: krPos.top, left: krPos.left, width: krPos.width, maxWidth: 320 }} className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1 max-h-64 overflow-y-auto">
                <button onClick={() => { setSelectedKR('ALL'); setKrOpen(false); setPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest ${selectedKR === 'ALL' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Semua KR</button>
                {uniqueKR.map(v => (<button key={v} onClick={() => { setSelectedKR(v); setKrOpen(false); setPage(1); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest ${selectedKR === v ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{v}</button>))}
              </motion.div></AnimatePresence></div>, document.body)}
            </div>
            <button onClick={loadData} disabled={isLoading} className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/30 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm shrink-0" title="Muat ulang data"><Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-500' : ''}`} /></button>
          </div>
        </div>
      </div>

      {isDummy && !isLoading && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Data Dummy - Masih dalam Pengembangan.
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Memuat Data KR Loading...</p>
        </div>
      ) : (
        <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Total Unit" value={totals.totalMuat.toLocaleString('id-ID')} sub={`${monthLabel} • sum total_muat`} icon={<Package className="w-5 h-5 text-sky-600" />} color="bg-sky-50 dark:bg-sky-500/10" />
            <StatCard label="Total Loading" value={totals.loadingCount.toLocaleString('id-ID')} sub="Baris muatan bulan ini" icon={<Truck className="w-5 h-5 text-violet-600" />} color="bg-violet-50 dark:bg-violet-500/10" />
            <StatCard label="Rata-rata Muat" value={totals.avgMuat.toLocaleString('id-ID')} sub="Unit per loading" icon={<Gauge className="w-5 h-5 text-amber-600" />} color="bg-amber-50 dark:bg-amber-500/10" />
            <StatCard label="Full Load" value={`${totals.fullLoads}`} sub="Muat 6 unit (car carrier penuh)" icon={<Trophy className="w-5 h-5 text-emerald-600" />} color="bg-emerald-50 dark:bg-emerald-500/10" />
            <StatCard label="Tujuan Aktif" value={totals.tujuanCount.toLocaleString('id-ID')} sub={`${totals.krCount} KR aktif`} icon={<Navigation className="w-5 h-5 text-rose-600" />} color="bg-rose-50 dark:bg-rose-500/10" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-sky-600 dark:text-sky-400" /></div>
                <div><h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Unit per Hari</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Batang = total unit dimuat harian</p></div>
              </div>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={(val) => { const d = new Date(val + 'T00:00:00'); return isNaN(d.getTime()) ? val : d.getDate().toString(); }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.4 }} content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = new Date(String(label) + 'T00:00:00');
                        const dayLabel = isNaN(d.getTime()) ? String(label) : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                        const row = trend.find(t => t.date === String(label));
                        return (
                          <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{dayLabel}</p>
                            <p className="text-xs font-black text-sky-600">{row?.total_muat ?? 0} unit • {row?.loading_count ?? 0} loading</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="total_muat" name="Unit" fill={COLORS.units} radius={[8, 8, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><Navigation className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                <div><h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Sebaran Tujuan</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Proporsi unit per tujuan pengiriman</p></div>
              </div>
              {summaryByTujuan.length === 0 ? (
                <div className="h-[340px] flex flex-col items-center justify-center text-slate-400"><MapPin className="w-8 h-8 mb-2 opacity-40" /><p className="text-xs font-black uppercase tracking-widest">Belum ada data tujuan</p></div>
              ) : (
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summaryByTujuan} dataKey="total_muat" nameKey="tujuan" cx="50%" cy="50%" innerRadius={72} outerRadius={118} paddingAngle={2} stroke="none">
                        {summaryByTujuan.map((_, i) => (<Cell key={i} fill={COLORS.tujuan[i % COLORS.tujuan.length]} />))}
                      </Pie>
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const p: any = payload[0];
                          return (
                            <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-black text-slate-500 uppercase">{p.name}</p>
                              <p className="text-xs font-black" style={{ color: p.payload.fill || p.color }}>{p.value} unit • {p.payload.loading_count} loading</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Legend formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">{value}</span>} iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center"><Gauge className="w-5 h-5 text-teal-600 dark:text-teal-400" /></div>
                <div><h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Kapasitas Muat</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Distribusi total_muat 1–6 unit per loading</p></div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={muatDist} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                    <XAxis dataKey="muat" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} tickFormatter={(v) => `${v} unit`} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.4 }} content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const d: any = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-black text-slate-900 dark:text-white">{d.muat} unit</p>
                            <p className="text-[11px] font-bold text-teal-600">{d.count} loading</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="count" name="Loading" fill={COLORS.muat} radius={[8, 8, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center"><Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                <div><h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Top KR</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Unit terbanyak bulan ini</p></div>
              </div>
              {summaryByKR.length === 0 ? (
                <div className="py-16 text-center text-slate-400"><Users className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-xs font-black uppercase tracking-widest">Belum ada data KR</p></div>
              ) : (
                <div className="space-y-2.5">
                  {summaryByKR.slice(0, 6).map((kr, idx) => (
                    <div key={kr.nama_kr} className={`flex items-center gap-3 p-3 rounded-2xl border ${idx === 0 ? 'bg-amber-50/70 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-900' : 'bg-white dark:bg-slate-700 text-slate-500 border border-slate-200 dark:border-slate-600'}`}>{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{kr.nama_kr}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{kr.loading_count} loading • {kr.lambung_count} lambung • avg {kr.avg_muat}/loading</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{kr.total_muat}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">unit</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center"><Package className="w-5 h-5 text-sky-600 dark:text-sky-400" /></div>
                <div><h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Detail Loading</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{monthLabel} • {sortedFiltered.length} baris • kolom sesuai sheet</p></div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><input type="text" placeholder="Cari KR / lambung / driver / tujuan..." value={searchQuery} onChange={e => { setPage(1); setSearchQuery(e.target.value); }} className="w-full sm:w-64 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500/15 focus:border-sky-400/40 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600" /></div>
                <button onClick={exportCSV} className="flex items-center gap-2 px-3.5 py-2 bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 transition-all"><FileText className="w-3.5 h-3.5" /> CSV</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">KR</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">PDC</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] whitespace-nowrap">Tgl / Jam Muat</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Lambung</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Driver</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Muat</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Rangka</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Tujuan</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">Aksi</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pagedData.length === 0 && (<tr><td colSpan={10} className="px-6 py-16 text-center"><AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-3" /><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada data loading untuk {monthLabel}</p></td></tr>)}
                  {pagedData.map(r => {
                    const filled = countRangkaFilled(r);
                    const ts = r.entry_timestamp ? new Date(r.entry_timestamp) : null;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-600 dark:text-slate-400">{ts && !isNaN(ts.getTime()) ? ts.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white max-w-[120px] truncate">{r.nama_kr}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-400"><Building2 className="w-3 h-3" /> {r.pdc_muat || '-'}</span></td>
                        <td className="px-4 py-3 whitespace-nowrap"><p className="font-bold text-slate-900 dark:text-white text-[11px]">{r.tanggal_muat || '-'}</p><p className="text-[9px] text-slate-400 font-bold">{r.jam_muat || ''}</p></td>
                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{r.no_lambung || '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400 max-w-[120px] truncate">{r.nama_driver || '-'}</td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex min-w-7 justify-center px-2 py-1 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 text-[10px] font-black">{r.total_muat ?? 0}</span></td>
                        <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${filled === (r.total_muat || 0) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : filled > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500'}`}><Hash className="w-3 h-3" /> {filled}/6</span></td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400"><MapPin className="w-3 h-3 text-slate-400" /> {r.tujuan_pengiriman || '-'}</span></td>
                        <td className="px-4 py-3 text-right"><button onClick={() => setDetailRow(r)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all" title="Lihat 6 rangka"><Package className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (<div className="flex justify-center items-center gap-2 py-5 border-t border-slate-100 dark:border-slate-800"><button disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"><ChevronLeft className="w-4 h-4" /></button><span className="text-xs font-black text-slate-400">{safePage} / {totalPages}</span><button disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"><ChevronRight className="w-4 h-4" /></button></div>)}
          </div>
        </motion.div>
      )}

      {createPortal(<AnimatePresence>{detailRow && (<div className="fixed inset-0 z-[20000] flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailRow(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800 flex flex-col"><div className="p-6 md:p-7 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start shrink-0"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center"><Truck className="w-6 h-6 text-sky-600 dark:text-sky-400" /></div><div><h3 className="text-base font-black text-slate-900 dark:text-white">{detailRow.nama_kr} • {detailRow.no_lambung || '-'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{detailRow.tanggal_muat} {detailRow.jam_muat || ''} • {detailRow.pdc_muat || '-'} → {detailRow.tujuan_pengiriman || '-'}</p></div></div><button onClick={() => setDetailRow(null)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button></div><div className="flex-1 overflow-y-auto p-6 md:p-7 space-y-5"><div className="grid grid-cols-3 gap-3"><div className="bg-sky-50 dark:bg-sky-900/20 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-sky-600">{detailRow.total_muat ?? 0}</p><p className="text-[9px] font-black text-sky-400 uppercase tracking-widest">Total Muat</p></div><div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 text-center"><p className="text-2xl font-black text-emerald-600">{countRangkaFilled(detailRow)}/6</p><p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Rangka Terisi</p></div><div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-3 text-center"><p className="text-sm font-black text-violet-600 truncate">{detailRow.tujuan_pengiriman || '-'}</p><p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Tujuan</p></div></div><div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-2 text-xs"><div className="flex justify-between"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Timestamp</span><span className="font-bold text-slate-600 dark:text-slate-400 text-[11px]">{detailRow.entry_timestamp ? new Date(detailRow.entry_timestamp).toLocaleString('id-ID') : '-'}</span></div><div className="flex justify-between"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">PDC Muat</span><span className="font-black text-slate-900 dark:text-white">{detailRow.pdc_muat || '-'}</span></div><div className="flex justify-between"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Tanggal / Jam</span><span className="font-black text-slate-900 dark:text-white">{detailRow.tanggal_muat} {detailRow.jam_muat || ''}</span></div><div className="flex justify-between"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Lambung • Driver</span><span className="font-black text-slate-900 dark:text-white">{detailRow.no_lambung || '-'} • {detailRow.nama_driver || '-'}</span></div></div><div><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">No Rangka — 6 kolom terpisah</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[1, 2, 3, 4, 5, 6].map(i => { const v = (detailRow as any)[`no_rangka_${i}`]; const filled = v && String(v).trim() && !['T/A', 'N/A', '-'].includes(String(v).trim().toUpperCase()); return (<div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs ${filled ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'}`}><span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Rangka {i}</span><span className={`font-mono font-bold text-[11px] truncate ml-2 ${filled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>{filled ? v : '—'}</span></div>); })}</div>{countRangkaFilled(detailRow) !== (detailRow.total_muat || 0) && detailRow.total_muat !== null && (<p className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Total muat ({detailRow.total_muat}) tidak sama dengan rangka terisi ({countRangkaFilled(detailRow)}).</p>)}</div></div></motion.div></div>)}</AnimatePresence>, document.body)}

      <AnimatePresence>{toast && (<motion.div key="toast" initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md"><div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${toast.type === 'success' ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-200 dark:border-rose-800'}`}><p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex-1">{toast.message}</p><button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"><X className="w-4 h-4" /></button></div></motion.div>)}</AnimatePresence>
    </div>
  );
}
