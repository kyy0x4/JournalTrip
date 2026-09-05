import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, CheckCircle2, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Download, X, UserCheck, FileText, Search, ShieldAlert, Loader2,
  XCircle, Check
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import {
  fetchDriverViolationSummary, fetchDriverViolationDetail, fetchDriverCoachingDetail,
  fetchViolationsForMonth, createManualCoachingSession, deleteCoachingSession,
  exportToCSV
} from '../services/driverAnalyticsService';
import { EcoViolation } from '../services/ecoDataFetcher';
import { DriverViolationMonth, DriverCoachingSession } from '../types';

export default function DriverAnalyticsPage({ isTAM = false }: { isTAM?: boolean }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [summary, setSummary] = useState<DriverViolationMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);
  const [areaPos, setAreaPos] = useState({ top: 0, left: 0, width: 0 });
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [detailDriver, setDetailDriver] = useState<DriverViolationMonth | null>(null);
  const [detailViolations, setDetailViolations] = useState<EcoViolation[]>([]);
  const [detailCoaching, setDetailCoaching] = useState<DriverCoachingSession[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [isSavingCoaching, setIsSavingCoaching] = useState(false);

  // ── Custom Toast ──
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; detail?: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((type: 'success' | 'error', message: string, detail?: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ type, message, detail });
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  // Ubah pesan error teknis Supabase jadi pesan yang ramah + hint perbaikan
  const friendlyError = (error: any): { message: string; detail?: string } => {
    const raw = (error && error.message) || '';
    if (/row.level security/i.test(raw)) {
      return {
        message: 'Gagal menandai coaching: akses database diblokir.',
        detail: 'Policy RLS belum aktif di database. Jalankan migrasi 20260814_coaching_rls_policy.sql di Supabase SQL Editor, lalu coba lagi.',
      };
    }
    if (/duplicate key|already exists|unique constraint/i.test(raw)) {
      return {
        message: 'Pelanggaran ini sudah tercatat dicoaching.',
        detail: raw,
      };
    }
    if (/network|failed to fetch|fetch failed|connection/i.test(raw)) {
      return {
        message: 'Koneksi ke server terputus.',
        detail: 'Periksa koneksi internet, lalu coba lagi.',
      };
    }
    return {
      message: 'Gagal menyimpan data. Coba lagi.',
      detail: raw || undefined,
    };
  };

  const areas = isTAM
    ? [
        { val: 'ALL', label: 'Semua Area' },
        { val: 'JBK', label: 'JBK' },
        { val: 'NGORO', label: 'NGORO' },
        { val: 'SUMATERA', label: 'SUMATERA' },
        { val: 'PADANG', label: 'PADANG' },
        { val: 'KALIMANTAN', label: 'KALIMANTAN' },
      ]
    : [
        { val: 'ALL', label: 'Semua Area' },
        { val: 'JBK', label: 'JBK' },
        { val: 'NGORO', label: 'NGORO' },
        { val: 'SUMATERA', label: 'SUMATERA' },
      ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDriverViolationSummary(selectedMonth, {
        area: selectedArea,
        isTAM,
      });
      setSummary(data);
    } catch (e) {
      console.error(e);
      setSummary([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedArea]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (areaDropdownOpen && areaDropdownRef.current && !areaDropdownRef.current.contains(target) && areaBtnRef.current && !areaBtnRef.current.contains(target)) {
        setAreaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [areaDropdownOpen]);

  useEscapeKey(() => setDetailDriver(null), !!detailDriver);

  const totalViolations = useMemo(() => summary.reduce((acc, d) => acc + d.violation_count, 0), [summary]);
  const totalCoaching = useMemo(() => summary.reduce((acc, d) => acc + d.coaching_count, 0), [summary]);
  const coverageRate = totalViolations > 0 ? Math.round((totalCoaching / totalViolations) * 1000) / 10 : 100;
  const topOffender = useMemo(() => (summary.length ? [...summary].sort((a, b) => b.violation_count - a.violation_count)[0] : null), [summary]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter(d =>
      d.driver_name.toLowerCase().includes(q) ||
      d.plat_nomor.toLowerCase().includes(q)
    );
  }, [summary, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedData = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage]
  );

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const openDetail = async (driver: DriverViolationMonth) => {
    setDetailDriver(driver);
    setDetailViolations([]);
    setDetailCoaching([]);
    setIsDetailLoading(true);
    try {
      const [violations, coaching] = await Promise.all([
        fetchDriverViolationDetail(driver.driver_id || '', selectedMonth),
        fetchDriverCoachingDetail(driver.driver_id || '', selectedMonth),
      ]);
      // Primary match via driver_id; fallback ke nama jika driver_id kosong
      const v = violations.length > 0
        ? violations
        : (await fetchViolationsForMonth(selectedMonth)).filter(
            x => x.pengemudi === driver.driver_name
          );
      setDetailViolations(v);
      setDetailCoaching(coaching);
    } catch (e) {
      console.error(e);
      setDetailViolations([]);
      setDetailCoaching([]);
    }
    setIsDetailLoading(false);
  };

  const markAsCoached = async (violation: EcoViolation) => {
    if (!detailDriver || isSavingCoaching) return;
    setIsSavingCoaching(true);
    try {
      const res = await createManualCoachingSession({
        driver_id: detailDriver.driver_id || '',
        violation_id: violation.id,
        violation_date: violation.tanggal,
        notes: `Ditandai manual sudah dicoaching (${violation.jenis_peringatan})`,
      });
      if (!res.success) {
        const err = friendlyError(res.error);
        showToast('error', err.message, err.detail);
        return;
      }
      showToast('success', `Berhasil menandai ${violation.pengemudi} sudah dicoaching`);
      // Refresh detail coaching
      const coaching = await fetchDriverCoachingDetail(detailDriver.driver_id || '', selectedMonth);
      setDetailCoaching(coaching);
      // Refresh summary table
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal menandai coaching.');
    } finally {
      setIsSavingCoaching(false);
    }
  };

  const unmarkCoached = async (sessionId: string) => {
    if (isSavingCoaching) return;
    setIsSavingCoaching(true);
    try {
      const res = await deleteCoachingSession(sessionId);
      if (!res.success) {
        const err = friendlyError(res.error);
        showToast('error', err.message, err.detail);
        return;
      }
      showToast('success', 'Tandai coaching berhasil dibatalkan');
      if (detailDriver) {
        const coaching = await fetchDriverCoachingDetail(detailDriver.driver_id || '', selectedMonth);
        setDetailCoaching(coaching);
      }
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal membatalkan coaching.');
    } finally {
      setIsSavingCoaching(false);
    }
  };

  const exportAllCSV = () => {
    if (summary.length === 0) {
      showToast('error', 'Tidak ada data untuk diexport.');
      return;
    }
    const rows = summary.map(d => ({
      'Driver': d.driver_name,
      'Plat Nomor': d.plat_nomor,
      'Bulan': monthLabel,
      'Total Pelanggaran': d.violation_count,
      'Total Coaching': d.coaching_count,
      'Coverage %': d.violation_count > 0 ? Math.round((d.coaching_count / d.violation_count) * 1000) / 10 : 100,
      'Pelanggaran Terakhir': d.last_violation_date || '-',
      'Coaching Terakhir': d.last_coaching_date || '-',
    }));
    exportToCSV(rows, `Driver_Analytics_${selectedMonth}.csv`);
    showToast('success', `CSV berhasil diexport (${rows.length} driver)`);
  };

  const exportDriverCSV = (driver: DriverViolationMonth) => {
    const rows = [{
      'Driver': driver.driver_name,
      'Plat Nomor': driver.plat_nomor,
      'Bulan': monthLabel,
      'Total Pelanggaran': driver.violation_count,
      'Total Coaching': driver.coaching_count,
      'Coverage %': driver.violation_count > 0 ? Math.round((driver.coaching_count / driver.violation_count) * 1000) / 10 : 100,
      'Pelanggaran Terakhir': driver.last_violation_date || '-',
      'Coaching Terakhir': driver.last_coaching_date || '-',
    }];
    exportToCSV(rows, `Driver_Analytics_${driver.driver_name.replace(/\s+/g, '_')}_${selectedMonth}.csv`);
    showToast('success', `CSV ${driver.driver_name} berhasil diexport`);
  };

  const exportAllPDF = async () => {
    if (isExporting || !tableRef.current) return;
    setIsExporting(true);
    try {
      const el = tableRef.current;
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) document.documentElement.classList.remove('dark');
      await new Promise(r => setTimeout(r, 300));
      const dataUrl = await htmlToImage.toJpeg(el, {
        quality: 0.85,
        backgroundColor: '#ffffff',
        pixelRatio: 1.5,
      });
      const pdfWidth = el.scrollWidth * 0.264583;
      const pdfHeight = el.scrollHeight * 0.264583;
      const pdf = new jsPDF(pdfWidth > pdfHeight ? 'l' : 'p', 'mm', [pdfHeight, pdfWidth]);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Driver_Analytics_${selectedMonth}.pdf`);
      if (isDark) document.documentElement.classList.add('dark');
      showToast('success', 'PDF berhasil diexport');
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal export PDF. Silakan coba kembali.');
    }
    setIsExporting(false);
  };

  const exportDriverPDF = async (driver: DriverViolationMonth) => {
    // Escape HTML entities biar nilai dari DB (nama driver, plat, dll) nggak
    // bisa dieksploitasi jadi injeksi HTML/script pas dirender ke innerHTML.
    const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c] as string));
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.style.top = '0';
    holder.style.background = '#ffffff';
    holder.style.color = '#0f172a';
    holder.style.fontFamily = 'Ginto Normal, Plus Jakarta Sans, sans-serif';
    holder.style.width = '720px';
    holder.style.padding = '28px';
    holder.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c15f3c;padding-bottom:14px;margin-bottom:18px;">
        <div>
          <div style="font-size:20px;font-weight:900;">Driver Analytics</div>
          <div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Laporan Bulanan</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b;font-weight:700;">${esc(monthLabel)}<br>K Line Fleet Monitoring</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:18px;">
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:9px;color:#94a3b8;font-weight:900;letter-spacing:1px;">DRIVER</div>
          <div style="font-size:15px;font-weight:900;margin-top:4px;">${esc(driver.driver_name)}</div>
          <div style="font-size:11px;color:#c15f3c;font-weight:800;margin-top:2px;">${esc(driver.plat_nomor || '-')}</div>
        </div>
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:9px;color:#94a3b8;font-weight:900;letter-spacing:1px;">PELANGGARAN</div>
          <div style="font-size:22px;font-weight:900;margin-top:4px;">${driver.violation_count}</div>
        </div>
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:9px;color:#94a3b8;font-weight:900;letter-spacing:1px;">COACHING</div>
          <div style="font-size:22px;font-weight:900;margin-top:4px;">${driver.coaching_count}</div>
        </div>
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:9px;color:#94a3b8;font-weight:900;letter-spacing:1px;">COVERAGE</div>
          <div style="font-size:22px;font-weight:900;margin-top:4px;color:#c15f3c;">${driver.violation_count > 0 ? Math.round((driver.coaching_count / driver.violation_count) * 1000) / 10 : 100}%</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <tr style="background:#c15f3c;color:white;">
          <th style="padding:8px 10px;text-align:left;">METRIK</th>
          <th style="padding:8px 10px;text-align:left;">NILAI</th>
        </tr>
        <tr><td style="padding:8px 10px;border:1px solid #e2e8f0;">Total Pelanggaran</td><td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:900;">${driver.violation_count}</td></tr>
        <tr><td style="padding:8px 10px;border:1px solid #e2e8f0;">Total Sesi Coaching</td><td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:900;">${driver.coaching_count}</td></tr>
        <tr><td style="padding:8px 10px;border:1px solid #e2e8f0;">Pelanggaran Terakhir</td><td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:900;">${esc(driver.last_violation_date || '-')}</td></tr>
        <tr><td style="padding:8px 10px;border:1px solid #e2e8f0;">Coaching Terakhir</td><td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:900;">${esc(driver.last_coaching_date || '-')}</td></tr>
      </table>
    `;
    document.body.appendChild(holder);
    try {
      const dataUrl = await htmlToImage.toJpeg(holder, { quality: 0.9, backgroundColor: '#ffffff', pixelRatio: 2 });
      const w = Math.min(holder.scrollWidth, 1000) * 0.264583;
      const h = holder.scrollHeight * 0.264583;
      const pdf = new jsPDF('p', 'mm', [h, w]);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h);
      pdf.save(`Driver_${driver.driver_name.replace(/\s+/g, '_')}_${selectedMonth}.pdf`);
      showToast('success', `PDF ${driver.driver_name} berhasil diexport`);
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal export PDF per driver.');
    } finally {
      document.body.removeChild(holder);
    }
  };

  const violationColor = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('akselerasi')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (t.includes('perlambatan')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (t.includes('kecepatan')) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (t.includes('tikungan')) return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Map violation_id -> coaching session (untuk tahu mana yang sudah ditandai)
  const coachedViolationIds = useMemo(() => {
    const map = new Map<string, DriverCoachingSession>();
    detailCoaching.forEach(cs => {
      if (cs.violation_id) map.set(String(cs.violation_id), cs);
    });
    return map;
  }, [detailCoaching]);

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
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6 md:w-7 md:h-7 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Driver Analytics</h1>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Violation & Coaching Report</p>
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

            <div className="relative group w-full sm:w-36">
              <button
                ref={areaBtnRef}
                onClick={() => {
                  if (areaBtnRef.current) {
                    const r = areaBtnRef.current.getBoundingClientRect();
                    const isMob = window.innerWidth < 640;
                    setAreaPos({
                      top: r.bottom + 8,
                      left: isMob ? Math.max(8, r.left) : r.left,
                      width: Math.max(r.width, isMob ? window.innerWidth - 16 : 144),
                    });
                  }
                  setAreaDropdownOpen(!areaDropdownOpen);
                }}
                className="w-full flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm"
              >
                <span className="truncate">{selectedArea === 'ALL' ? 'Area' : selectedArea}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>
              {areaDropdownOpen && createPortal(
                <div className="fixed inset-0 z-11000 pointer-events-none">
                  <AnimatePresence>
                    <motion.div
                      ref={areaDropdownRef}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      style={{ position: 'fixed', top: areaPos.top, left: areaPos.left, width: areaPos.width, maxWidth: 320 }}
                      className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1"
                    >
                      {areas.map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => { setSelectedArea(opt.val); setAreaDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${selectedArea === opt.val ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>,
                document.body
              )}
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm shrink-0"
              title="Muat ulang data"
            >
              <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin text-red-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Memuat Data Analytics...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* ── SUMMARY CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Pelanggaran"
                value={totalViolations.toLocaleString('id-ID')}
                sub={`Bulan ${monthLabel}`}
                icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
                color="bg-rose-50 dark:bg-rose-500/10"
              />
              <StatCard
                label="Total Coaching"
                value={totalCoaching.toLocaleString('id-ID')}
                sub="Sesi coaching bulan ini"
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                color="bg-emerald-50 dark:bg-emerald-500/10"
              />
              <StatCard
                label="Coaching Coverage"
                value={`${coverageRate.toLocaleString('id-ID')}%`}
                sub="Sesi coaching per pelanggaran"
                icon={<ClipboardList className="w-5 h-5 text-amber-600" />}
                color="bg-amber-50 dark:bg-amber-500/10"
              />
              <StatCard
                label="Top Pelanggar"
                value={topOffender?.driver_name || '-'}
                sub={topOffender ? `${topOffender.violation_count} pelanggaran • ${topOffender.plat_nomor}` : 'Belum ada data'}
                icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                color="bg-red-50 dark:bg-red-500/10"
              />
            </div>

            {/* ── TABLE ── */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              {/* Table toolbar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Rekap Per Driver</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{monthLabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari driver / plat..."
                      value={searchQuery}
                      onChange={e => { setPage(1); setSearchQuery(e.target.value); }}
                      className="w-full sm:w-52 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-400/40 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                  <button
                    onClick={exportAllCSV}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={exportAllPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3.5 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                  </button>
                </div>
              </div>

              {/* Table body (for PDF export) */}
              <div ref={tableRef}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Driver</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Plat Nomor</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Pelanggaran</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Coaching</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Coverage</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Pelanggaran Terakhir</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right no-print">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pagedData.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-16 text-center">
                            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Belum ada data pelanggaran untuk {monthLabel}
                            </p>
                          </td>
                        </tr>
                      )}
                      {pagedData.map(driver => (
                        <tr key={`${driver.driver_id || 'x'}-${driver.driver_name}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                <UserCheck className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </div>
                              <div>
                                <p className="font-black text-slate-900 dark:text-white">{driver.driver_name}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{driver.month}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-slate-700 dark:text-slate-300">{driver.plat_nomor}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                              driver.violation_count > 5 ? 'bg-rose-100 text-rose-700' : driver.violation_count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {driver.violation_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                              driver.coaching_count > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {driver.coaching_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                                {driver.violation_count > 0 ? Math.round((driver.coaching_count / driver.violation_count) * 1000) / 10 : 100}%
                              </span>
                              <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${driver.violation_count > 0 && driver.coaching_count / driver.violation_count < 0.5 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(100, driver.violation_count > 0 ? (driver.coaching_count / driver.violation_count) * 100 : 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-slate-400">{driver.last_violation_date || '-'}</span>
                          </td>
                          <td className="px-6 py-4 no-print">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openDetail(driver)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title="Lihat detail"
                              >
                                <ClipboardList className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => exportDriverCSV(driver)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title="Export CSV per driver"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => exportDriverPDF(driver)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title="Export PDF per driver"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 py-5 border-t border-slate-100 dark:border-slate-800 no-print">
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
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── DETAIL MODAL ── */}
      {createPortal(
        <AnimatePresence>
          {detailDriver && (
            <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDetailDriver(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800 flex flex-col"
              >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">{detailDriver.driver_name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {detailDriver.plat_nomor} • {monthLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailDriver(null)}
                    className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary pills */}
                <div className="grid grid-cols-3 gap-3 px-6 md:px-8 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-rose-600">{detailDriver.violation_count}</p>
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Pelanggaran</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-emerald-600">{detailDriver.coaching_count}</p>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Coaching</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-amber-600">
                      {detailDriver.violation_count > 0 ? Math.round((detailDriver.coaching_count / detailDriver.violation_count) * 1000) / 10 : 100}%
                    </p>
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Coverage</p>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  {isDetailLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                      <div className="w-9 h-9 border-3 border-red-200 border-t-red-600 rounded-full animate-spin" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat detail...</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Violations */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          Riwayat Pelanggaran ({detailViolations.length})
                        </h4>
                        {detailViolations.length === 0 ? (
                          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl py-8 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tidak ada pelanggaran bulan ini</p>
                          </div>
                        ) : (
                          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                              {detailViolations.map((v, i) => {
                                const coached = coachedViolationIds.get(String(v.id));
                                return (
                                <div key={`${v.id}-${i}`} className="px-4 py-3 flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${violationColor(v.jenis_peringatan)}`}>
                                    <AlertTriangle className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{v.jenis_peringatan}</p>
                                    <p className="text-[9px] text-slate-400 font-bold truncate">{v.lokasi || 'Lokasi tidak tersedia'}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">{v.tanggal}</p>
                                    <p className="text-[9px] text-slate-400 font-bold">{v.waktu}</p>
                                  </div>
                                  {coached ? (
                                    <button
                                      onClick={() => unmarkCoached(coached.id)}
                                      disabled={isSavingCoaching}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shrink-0 disabled:opacity-50"
                                      title="Klik untuk batalkan"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> Coached
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => markAsCoached(v)}
                                      disabled={isSavingCoaching}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shrink-0 disabled:opacity-50"
                                      title="Tandai sudah dicoaching"
                                    >
                                      <UserCheck className="w-3 h-3" /> Tandai
                                    </button>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coaching */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                          Riwayat Coaching ({detailCoaching.length})
                        </h4>
                        {detailCoaching.length === 0 ? (
                          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl py-8 text-center">
                            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada coaching bulan ini</p>
                          </div>
                        ) : (
                          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                              {detailCoaching.map((cs, i) => (
                                <div key={cs.id || i} className="px-4 py-3 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-900 dark:text-white">
                                      {cs.status === 'completed' ? 'Terverifikasi' : cs.status}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold truncate">
                                      {cs.notes || 'Auto coaching dari pelanggaran'} • {cs.coached_by || 'AUTO'}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">{cs.violation_date}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

      {/* ── Custom Toast ── */}
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
                toast.type === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white'
              }`}>
                {toast.type === 'success' ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {toast.message}
                </p>
                {toast.detail && (
                  <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug break-words">
                    {toast.detail}
                  </p>
                )}
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
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