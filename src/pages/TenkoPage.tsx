import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Heart, Thermometer, Wine, Eye, Moon, AlertCircle,
  Calendar, Search, ChevronDown, CheckCircle2, XCircle,
  TrendingUp, BarChart3, PieChart as PieIcon, ClipboardList,
  Building2, Users, Pencil, Loader2, LogIn, Lock,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area as ReArea
} from 'recharts';
import { supabase } from '../lib/supabase';
import AuthModal from '../components/auth/AuthModal';
import * as tenkoService from '../services/tenkoService';
import {
  TenkoRecord,
  TenkoSummary,
  TenkoMetricConfig,
  MetricTrendPoint,
  TENKO_HEALTH_METRICS,
  TENSI_FAKTOR_OPTIONS,
  isHipertensi,
  getHipertensiTypeLabel,
  formatTensiFaktorDisplay,
} from '../services/tenkoService';

const COLORS = {
  normal: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  neutral: '#94a3b8'
};

const METRIC_ICONS: Record<string, React.ReactNode> = {
  tensi: <Heart className="w-6 h-6 text-red-500" />,
  suhu: <Thermometer className="w-6 h-6 text-orange-500" />,
  rest: <Moon className="w-6 h-6 text-indigo-500" />,
  nadi: <Activity className="w-6 h-6 text-blue-500" />,
  alkohol: <Wine className="w-6 h-6 text-purple-500" />,
  fatigue: <Zap className="w-6 h-6 text-amber-500" />,
  mental: <Eye className="w-6 h-6 text-emerald-500" />,
};

export default function TenkoPage({ isTAM = false }: { isTAM?: boolean }) {
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [personnelType, setPersonnelType] = useState('ALL'); // ALL, DRIVER, ASST
  const [customers, setCustomers] = useState<string[]>(['ALL']);
  const [areas, setAreas] = useState<string[]>(['ALL']);
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [dateMode, setDateMode] = useState<'BULAN' | 'TANGGAL'>('BULAN');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [startDate, setStartDate] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  );
  const [endDate, setEndDate] = useState(() => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]);

  const handleMonthChange = (monthStr: string) => {
    setSelectedMonth(monthStr);
    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    setStartDate(`${monthStr}-01`);
    setEndDate(`${monthStr}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleModeSwitch = (mode: 'BULAN' | 'TANGGAL') => {
    setDateMode(mode);
    if (mode === 'BULAN') handleMonthChange(selectedMonth);
  };
  const [summary, setSummary] = useState<TenkoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [crossFilter, setCrossFilter] = useState<{ tensiStatus: string | null; date: string | null }>({ tensiStatus: null, date: null });
  const [metricPage, setMetricPage] = useState(0);
  const [chartView, setChartView] = useState<'date' | 'driver'>('date');
  const activeMetric: TenkoMetricConfig = TENKO_HEALTH_METRICS[metricPage];
  const totalMetricPages = TENKO_HEALTH_METRICS.length;

  const toggleCrossFilter = (key: 'tensiStatus' | 'date', value: string) => {
    setCrossFilter(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };
  const clearCrossFilters = () => setCrossFilter({ tensiStatus: null, date: null });

  // Initial load for areas
  useEffect(() => {
    const loadAreas = async () => {
      const dynamicAreas = await tenkoService.fetchUniqueAreas();
      if (isTAM) {
        const allowedTAM = ['ALL', 'JBK', 'NGORO', 'SUMATERA', 'PADANG', 'KALIMANTAN', 'SULAWESI'];
        setAreas(dynamicAreas.filter(a => allowedTAM.includes(a.toUpperCase())));
      } else {
        setAreas(dynamicAreas);
      }
    };
    loadAreas();
  }, []);

  // Cascading effect: Fetch customers based on area
  useEffect(() => {
    const loadCustomers = async () => {
      let dynamicCustomers = await tenkoService.fetchUniqueCustomers(selectedArea);
      if (isTAM) {
        dynamicCustomers = dynamicCustomers.filter(c => !c.toUpperCase().includes('TMMIN'));
      }
      setCustomers(dynamicCustomers);
      
      // Reset customer if it's not in the new list (except for 'ALL')
      if (selectedCustomer !== 'ALL' && !dynamicCustomers.includes(selectedCustomer)) {
        setSelectedCustomer('ALL');
      }
    };
    loadCustomers();
  }, [selectedArea, isTAM]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setCrossFilter({ tensiStatus: null, date: null });
      const data = await tenkoService.fetchTenkoData(startDate, endDate, selectedCustomer, selectedArea, personnelType);
      
      if (isTAM && data.summary && data.summary.raw) {
        const filteredRaw = data.summary.raw.filter(r => {
          const area = (r.area || '').toUpperCase();
          const proj = (r.customer || (r as any).Customer || (r as any).project || '').toUpperCase();
          return !area.includes('SULAWESI') && !proj.includes('TMMIN');
        });
        setSummary(tenkoService.calculateSummary(filteredRaw));
      } else {
        setSummary(data.summary);
      }
      setLoading(false);
    };
    loadData();
  }, [startDate, endDate, selectedCustomer, selectedArea, personnelType]);

  const crossFilteredRecords = useMemo(() => {
    if (!summary?.raw) return [];
    return summary.raw.filter(r => {
      if (crossFilter.tensiStatus) {
        if (crossFilter.tensiStatus === 'Normal' && (r.sistolik >= 145 || r.diastolik >= 90 || r.sistolik < 90 || r.diastolik < 60)) return false;
        if (crossFilter.tensiStatus === 'Hipertensi' && !(r.sistolik >= 145 || r.diastolik >= 90)) return false;
        if (crossFilter.tensiStatus === 'Hipotensi' && !(r.sistolik < 90 || r.diastolik < 60)) return false;
      }
      if (crossFilter.date && !tenkoService.matchesPeriodFilter(r.tanggal, crossFilter.date)) return false;
      if (searchQuery && !r.nama_driver?.toLowerCase().includes(searchQuery.toLowerCase()) && !r.nopol?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [summary, crossFilter, searchQuery]);

  const crossSummary = useMemo(() => {
    if (!crossFilter.tensiStatus && !crossFilter.date) return summary;
    return tenkoService.calculateSummary(crossFilteredRecords);
  }, [crossFilteredRecords, crossFilter, summary]);

  const metricPieData = useMemo(() => {
    if (!summary) return [];
    return tenkoService.getMetricPieSlices(summary, activeMetric.id);
  }, [summary, activeMetric.id]);

  const chartDateGranularity = useMemo(
    () => (tenkoService.shouldUseMonthlyTrend(startDate, endDate) ? 'month' : 'day'),
    [startDate, endDate]
  );
  // Rentang <= 31 hari selalu per-hari (walau beda bulan); per-bulan hanya kalau rentang panjang
  const chartPeriodLabel = useMemo(
    () => (chartDateGranularity === 'month' ? 'Monitoring Bulanan — Periode Terpilih' : 'Monitoring Harian — Periode Terpilih'),
    [chartDateGranularity]
  );

  const dateTrendData = useMemo(() => {
    if (!summary?.raw) return [];
    return tenkoService.buildPeriodMetricTrends(summary.raw, startDate, endDate, chartDateGranularity, activeMetric);
  }, [summary, startDate, endDate, chartDateGranularity, activeMetric]);

  const driverTrendData = useMemo(() => {
    if (!summary?.raw) return [];
    return tenkoService.buildDriverMetricTrends(summary.raw, startDate, endDate, activeMetric);
  }, [summary, startDate, endDate, activeMetric]);

  const chartData: MetricTrendPoint[] = chartView === 'date' ? dateTrendData : driverTrendData;
  const chartBarSize = chartView === 'driver' ? Math.max(12, Math.min(40, 600 / Math.max(chartData.length, 1))) : 40;
  const driverChartLocked = chartView === 'driver' && selectedCustomer === 'ALL';

  const goToMetricPage = (next: number) => {
    const wrapped = ((next % totalMetricPages) + totalMetricPages) % totalMetricPages;
    setMetricPage(wrapped);
    if (TENKO_HEALTH_METRICS[wrapped].id !== 'tensi') {
      setCrossFilter(prev => ({ ...prev, tensiStatus: null }));
    }
  };

  const hasActiveCrossFilter = crossFilter.tensiStatus !== null || crossFilter.date !== null;

  const [editingFaktor, setEditingFaktor] = useState<TenkoRecord | null>(null);
  const [faktorForm, setFaktorForm] = useState({ tensi_faktor: '', tensi_keterangan: '' });
  const [savingFaktor, setSavingFaktor] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setUserEmail(session?.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEscapeKey(() => setIsAuthModalOpen(false), !!isAuthModalOpen);

  const promptLogin = (action?: () => void) => {
    if (action) setPendingAction(() => action);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const showFaktorEditor = (record: TenkoRecord) => {
    setEditingFaktor(record);
    setFaktorForm({
      tensi_faktor: record.tensi_faktor || '',
      tensi_keterangan: record.tensi_keterangan || '',
    });
  };

  const openFaktorEditor = async (record: TenkoRecord) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      promptLogin(() => showFaktorEditor(record));
      return;
    }
    showFaktorEditor(record);
  };

  const handleSaveFaktor = async () => {
    if (!editingFaktor) return;
    if (!faktorForm.tensi_faktor) {
      alert('Pilih faktor hipertensi sebelum menyimpan.');
      return;
    }
    if (faktorForm.tensi_faktor === 'Lainnya' && !faktorForm.tensi_keterangan.trim()) {
      alert('Isi keterangan faktor untuk opsi Lainnya.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      promptLogin(() => { void handleSaveFaktor(); });
      return;
    }

    setSavingFaktor(true);
    const keterangan = faktorForm.tensi_keterangan.trim() || null;
    const res = await tenkoService.updateTensiFaktor(editingFaktor, faktorForm.tensi_faktor, keterangan);
    setSavingFaktor(false);
    if (!res.success) {
      alert(`Gagal menyimpan: ${res.error || 'Unknown error'}`);
      return;
    }
    setSummary(prev => {
      if (!prev) return prev;
      const updatedRaw = prev.raw.map(r =>
        r.id === editingFaktor.id
          ? { ...r, tensi_faktor: faktorForm.tensi_faktor, tensi_keterangan: keterangan }
          : r
      );
      return { ...prev, raw: updatedRaw };
    });
    setEditingFaktor(null);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  useEffect(() => setCurrentPage(1), [crossFilter, searchQuery]);
  const totalPages = Math.ceil(crossFilteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = crossFilteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 pb-20 px-1">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900/60 backdrop-blur-xl p-4 md:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-blue-500/5 relative z-10 overflow-visible">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 overflow-visible">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0"><Activity className="w-5 h-5 md:w-6 md:h-6 text-white" /></div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Tenko Daily Dashboard</h1>
              <p className="text-[10px] md:text-xs text-slate-500 font-bold flex items-center gap-1 mt-0.5 md:mt-1 uppercase tracking-widest"><ClipboardList className="w-3 h-3" /> Driver Health &amp; Safety Check</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-3 w-full lg:w-auto lg:ml-auto overflow-visible">

            {/* Toggle BULAN / TANGGAL */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
              {(['BULAN', 'TANGGAL'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => handleModeSwitch(mode)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    dateMode === mode
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}>
                  {mode}
                </button>
              ))}
            </div>

            {/* Date Control: conditional by mode */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700/50 w-full sm:w-auto justify-center sm:justify-start">
              <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
              {dateMode === 'BULAN' ? (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-700 dark:text-slate-200 w-full sm:w-auto text-center sm:text-left"
                />
              ) : (
                <div className="flex items-center gap-2 flex-1 sm:flex-none justify-center">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-700 dark:text-slate-200 w-full sm:w-auto p-0" />
                  <span className="text-slate-400 font-bold">→</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-700 dark:text-slate-200 w-full sm:w-auto p-0" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 w-full lg:w-auto">
              <AreaDropdown areas={areas} selected={selectedArea} onChange={setSelectedArea} />
              <CustomerDropdown customers={customers} selected={selectedCustomer} onChange={setSelectedCustomer} highlighted={driverChartLocked} />
              <div className="col-span-2 sm:col-span-1">
                <PersonnelDropdown value={personnelType} onChange={setPersonnelType} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>


      {hasActiveCrossFilter && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Filters:</span>
          {crossFilter.tensiStatus && (
            <button onClick={() => toggleCrossFilter('tensiStatus', crossFilter.tensiStatus!)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[10px] font-black text-blue-500 uppercase hover:bg-blue-500/20 transition-all">
              <Heart className="w-3 h-3" /> Tensi: {crossFilter.tensiStatus} <XCircle className="w-3 h-3" />
            </button>
          )}
          {crossFilter.date && (
            <button onClick={() => toggleCrossFilter('date', crossFilter.date!)} className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-[10px] font-black text-purple-500 uppercase hover:bg-purple-500/20 transition-all">
              <Calendar className="w-3 h-3" /> {crossFilter.date.length === 7 ? 'Bulan' : 'Tanggal'}: {tenkoService.formatTrendPeriodLabel(crossFilter.date, crossFilter.date.length === 7 ? 'month' : 'day')} <XCircle className="w-3 h-3" />
            </button>
          )}
          <button onClick={clearCrossFilters} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase transition-colors">Clear All ×</button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Activity} label="Total Checkups" value={crossSummary?.totalCheckups || 0} sub={hasActiveCrossFilter ? 'Filtered results' : 'Drivers verified'} color="text-blue-500" bgColor="bg-blue-500/10" />
        <StatCard icon={Heart} label="Abnormal Tensi" value={(crossSummary?.tensi.hipertensi || 0) + (crossSummary?.tensi.hipotensi || 0)} sub="Requires monitoring" color="text-rose-500" bgColor="bg-rose-500/10" trend={crossSummary ? `${((((crossSummary.tensi.hipertensi + crossSummary.tensi.hipotensi) / (crossSummary.totalCheckups || 1)) || 0) * 100).toFixed(1)}%` : '0%'} />
        <StatCard icon={Thermometer} label="Body Temp Alert" value={crossSummary?.suhu.demam || 0} sub="Over 37.5°C" color="text-orange-500" bgColor="bg-orange-500/10" />
        <StatCard icon={Wine} label="Alcohol Check" value={crossSummary?.alkohol.positif || 0} sub="Positive cases" color={crossSummary?.alkohol.positif ? 'text-rose-600' : 'text-emerald-500'} bgColor={crossSummary?.alkohol.positif ? 'bg-rose-500/10' : 'bg-emerald-500/10'} />
      </div>

      {/* Metric chart pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
        <button
          type="button"
          onClick={() => goToMetricPage(metricPage - 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Sebelumnya
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {TENKO_HEALTH_METRICS.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onClick={() => goToMetricPage(idx)}
              title={m.title}
              className={`h-2.5 rounded-full transition-all ${
                idx === metricPage
                  ? 'w-8 bg-blue-500'
                  : 'w-2.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goToMetricPage(metricPage + 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all shadow-sm"
        >
          Selanjutnya <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="text-center -mt-2 mb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Halaman {metricPage + 1} / {totalMetricPages} — {activeMetric.title}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeMetric.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 xl:grid-cols-3 gap-8"
        >
          <div className="xl:col-span-2 bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  {METRIC_ICONS[activeMetric.id]} {activeMetric.title} Analysis
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                  {chartView === 'date'
                    ? chartPeriodLabel
                    : `${activeMetric.title} per Driver — Periode Terpilih (Drivers Only)`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
                  {([
                    { key: 'date' as const, label: 'Per Tanggal', icon: Calendar },
                    { key: 'driver' as const, label: 'Per Driver', icon: Users },
                  ]).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setChartView(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                        chartView === key
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {activeMetric.categories.map(cat => (
                    <div key={cat.key} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] font-black text-slate-400 uppercase">{cat.shortLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={`relative w-full ${chartView === 'driver' ? 'h-[520px]' : 'h-[460px]'}`}>
              <div className={`h-full w-full transition-all duration-300 ${driverChartLocked ? 'blur-md opacity-40 pointer-events-none select-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={chartView === 'driver' ? { bottom: 60 } : undefined}
                    onClick={(e: any) => {
                      if (driverChartLocked) return;
                      const payload = e?.activePayload?.[0]?.payload;
                      if (!payload) return;
                      if (chartView === 'date') toggleCrossFilter('date', payload.period);
                      else setSearchQuery(String(payload.driver));
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.1} />
                    <XAxis
                      dataKey={chartView === 'date' ? 'period' : 'driver'}
                      axisLine={false}
                      tickLine={false}
                      interval={chartView === 'driver' ? 0 : 'preserveStartEnd'}
                      minTickGap={10}
                      angle={chartView === 'driver' ? -35 : -35}
                      textAnchor="end"
                      height={chartView === 'driver' ? 70 : 60}
                      tick={{ fontSize: chartView === 'driver' ? 8 : 10, fontWeight: 900, fill: '#94a3b8' }}
                      tickFormatter={(val: string) =>
                        chartView === 'date'
                          ? tenkoService.formatTrendPeriodLabel(val, chartDateGranularity)
                          : val.length > 12 ? `${val.slice(0, 10)}…` : val
                      }
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip labelKey={chartView === 'date' ? 'period' : 'driver'} periodGranularity={chartDateGranularity} />} />
                    {activeMetric.categories.map((cat, idx) => (
                      <Bar
                        key={cat.key}
                        dataKey={cat.key}
                        name={cat.label}
                        stackId="a"
                        fill={cat.color}
                        barSize={chartBarSize}
                        radius={idx === activeMetric.categories.length - 1 ? [6, 6, 0, 0] : undefined}
                        cursor={driverChartLocked ? 'default' : 'pointer'}
                      />
                    ))}
                    <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <AnimatePresence>
                {driverChartLocked && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/30 dark:bg-slate-900/30 backdrop-blur-[2px]"
                  >
                    <div className="mx-4 max-w-sm text-center px-6 py-5 bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-500" />
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Pilih Customer Dulu</p>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                        Chart per driver butuh filter customer spesifik. Pilih customer di filter atas — misalnya TAM atau TMMIN. Hanya data driver, tanpa assistant.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col items-center justify-center">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 text-center">{activeMetric.pieTitle}</h3>
            <div className="h-[350px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metricPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={120}
                    paddingAngle={8}
                    dataKey="value"
                    onClick={(entry: any) => {
                      if (activeMetric.id === 'tensi' && entry.filterName) {
                        toggleCrossFilter('tensiStatus', entry.filterName);
                      }
                    }}
                    cursor={activeMetric.id === 'tensi' ? 'pointer' : 'default'}
                  >
                    {metricPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={
                          activeMetric.id === 'tensi' && crossFilter.tensiStatus
                            ? (crossFilter.tensiStatus === entry.filterName ? 1 : 0.35)
                            : 1
                        }
                        stroke={activeMetric.id === 'tensi' && crossFilter.tensiStatus === entry.filterName ? '#ffffff' : 'transparent'}
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<MetricPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{summary?.totalCheckups || 0}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase">Total Cek</span>
              </div>
            </div>
            <div className="grid grid-cols-1 w-full gap-2 mt-8">
              {metricPieData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{item.percent.toFixed(1)}%</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-2">({item.value})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-blue-500/5">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Tenko Detailed Records</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Individual checkup results list</p>
            {!isLoggedIn ? (
              <button
                type="button"
                onClick={() => promptLogin()}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase hover:bg-amber-500/20 transition-all"
              >
                <Lock className="w-3 h-3" />
                Login dulu untuk isi faktor tensi
              </button>
            ) : (
              <p className="mt-3 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                ✓ Login sebagai {userEmail?.split('@')[0] || 'Tim Tenko'} — bisa edit faktor
              </p>
            )}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Cari driver atau nopol..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-none rounded-2xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500 shadow-inner uppercase" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Driver & Vehicle</th>
                <th className="px-6 py-5">Tensi (BP)</th>
                <th className="px-6 py-5">Temp & Pulse</th>
                <th className="px-6 py-5">SPO2 & Rest</th>
                <th className="px-6 py-5">Safety Status</th>
                <th className="px-8 py-5 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRecords.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all">
                  <td className="px-8 py-5">
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{r.nama_driver}</p>
                    <p className="text-[10px] font-bold text-blue-500 uppercase mt-1">{r.nopol} • {r.no_lambung}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <motion.span 
                          animate={(r.sistolik >= 145 || r.diastolik >= 90 || r.sistolik < 90 || r.diastolik < 60) ? { 
                            opacity: [1, 0.4, 1],
                          } : {}}
                          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                            isHipertensi(r.sistolik, r.diastolik) ? 'bg-rose-500/10 text-rose-500 shadow-lg shadow-rose-500/20' : (r.sistolik < 90 || r.diastolik < 60) ? 'bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/20' : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                          {r.tensi}
                        </motion.span>
                        <span className="text-[10px] font-bold text-slate-400">mmHg</span>
                      </div>
                      {isHipertensi(r.sistolik, r.diastolik) && (
                        <div className="max-w-[220px]">
                          <p className="text-[9px] font-black text-rose-500/80 uppercase tracking-wide">
                            {getHipertensiTypeLabel(r.sistolik, r.diastolik)}
                          </p>
                          {isLoggedIn ? (
                            <button
                              type="button"
                              onClick={() => openFaktorEditor(r)}
                              className={`mt-1 flex items-start gap-1.5 text-left group transition-colors ${
                                formatTensiFaktorDisplay(r)
                                  ? 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                                  : 'text-amber-600 dark:text-amber-400 hover:text-amber-500'
                              }`}
                            >
                              <Pencil className="w-3 h-3 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100" />
                              <span className="text-[9px] font-bold leading-snug">
                                {formatTensiFaktorDisplay(r) || 'Faktor belum diisi — klik untuk isi'}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { void openFaktorEditor(r); }}
                              className="mt-1 flex items-start gap-1.5 text-left text-slate-400 hover:text-amber-500 transition-colors"
                            >
                              <LogIn className="w-3 h-3 shrink-0 mt-0.5" />
                              <span className="text-[9px] font-bold leading-snug">
                                {formatTensiFaktorDisplay(r) || 'Login dulu untuk isi faktor'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5"><p className="text-xs font-black text-slate-700 dark:text-slate-300">{r.suhu_tubuh}°C</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{r.denyut_nadi} BPM</p></td>
                  <td className="px-6 py-5"><p className="text-xs font-black text-slate-700 dark:text-slate-300">{r.oxygen_saturation}% O₂</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{r.rest_time}h Rest</p></td>
                  <td className="px-6 py-5"><div className="flex items-center gap-2"><StatusBadge label="Alc" ok={Number(r.alkohol) === 0} /><StatusBadge label="Eye" ok={r.mata === 'OK'} /><StatusBadge label="Fat" ok={r.fatigue === 'NORMAL'} /></div></td>
                  <td className="px-8 py-5 text-right">
                    {r.sistolik < 145 && r.diastolik < 90 && r.suhu_tubuh < 37.5 && Number(r.alkohol) === 0 ? (
                      <span className="flex items-center justify-end gap-1.5 text-[10px] font-black text-emerald-500 uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5" /> FIT TO DRIVE
                      </span>
                    ) : (
                      <motion.span 
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="flex items-center justify-end gap-1.5 text-[10px] font-black text-rose-500 uppercase"
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> UNFIT
                      </motion.span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, crossFilteredRecords.length)} of {crossFilteredRecords.length} records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >← Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                if (page < 1 || page > totalPages) return null;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                      currentPage === page ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>{page}</button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >Next →</button>
            </div>
          </div>
        )}
      </motion.div>

      {editingFaktor && createPortal(
        <div
          className="fixed inset-0 z-12000 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingFaktor(null); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Isi Faktor Hipertensi</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{editingFaktor.nama_driver} • {editingFaktor.tensi} mmHg</p>
              {userEmail && (
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 uppercase">
                  Disimpan sebagai {userEmail.split('@')[0]}
                </p>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Faktor Hipertensi *</label>
                <select
                  value={faktorForm.tensi_faktor}
                  onChange={(e) => setFaktorForm(prev => ({ ...prev, tensi_faktor: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none"
                >
                  <option value="">— Pilih Faktor —</option>
                  {TENSI_FAKTOR_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Keterangan {faktorForm.tensi_faktor === 'Lainnya' ? '*' : '(Opsional)'}
                </label>
                <textarea
                  rows={3}
                  value={faktorForm.tensi_keterangan}
                  onChange={(e) => setFaktorForm(prev => ({ ...prev, tensi_keterangan: e.target.value }))}
                  placeholder="Detail faktor / kondisi driver..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => setEditingFaktor(null)}
                disabled={savingFaktor}
                className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveFaktor}
                disabled={savingFaktor}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-lg shadow-red-500/20"
              >
                {savingFaktor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Simpan
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bgColor, trend }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-start justify-between"><div className={`w-12 h-12 ${bgColor} rounded-2xl flex items-center justify-center`}><Icon className={`w-6 h-6 ${color}`} /></div>{trend && <span className="text-[10px] font-black px-2 py-1 bg-red-500/10 text-red-500 rounded-lg">{trend}</span>}</div>
      <div className="mt-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p><p className={`text-2xl font-black text-slate-900 dark:text-white mt-1`}>{value}</p><p className="text-[10px] font-bold text-slate-500 mt-1">{sub}</p></div>
    </motion.div>
  );
}

function StatusBadge({ label, ok }: { label: string, ok: boolean }) {
  return (
    <div className={`px-2 py-1 rounded-lg flex items-center gap-1 border ${ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/5 border-rose-500/20 text-rose-500'}`}>
      <span className="text-[8px] font-black uppercase">{label}</span>{ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
    </div>
  );
}

function AreaDropdown({ areas, selected, onChange }: { areas: string[]; selected: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const isMob = window.innerWidth < 640;
      setDropPos({ 
        top: r.bottom + 8, 
        left: isMob ? Math.max(8, r.left) : r.left,
        width: Math.max(r.width, isMob ? window.innerWidth - 16 : 256)
      });
    }
    setOpen(v => !v);
  };

  const filtered = areas.filter(a => a.toLowerCase().includes(search.toLowerCase()));
  const AREA_COLORS: Record<string, string> = {
    ALL: 'bg-slate-500', KARAWANG: 'bg-blue-500', BEKASI: 'bg-orange-500', SULAWESI: 'bg-red-500', KALIMANTAN: 'bg-emerald-500',
  };
  const getColor = (a: string) => AREA_COLORS[a.toUpperCase()] || 'bg-slate-400';
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen} type="button"
        className="flex items-center gap-2 pl-3 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm hover:border-blue-400 focus:ring-2 focus:ring-blue-500/30 min-w-[140px] w-full sm:w-auto">
        <div className={`w-2 h-2 rounded-full shrink-0 ${getColor(selected)}`} />
        <span className="flex-1 text-left text-slate-700 dark:text-slate-200 truncate">{selected === 'ALL' ? 'ALL AREA' : selected}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-11000 pointer-events-none">
          <AnimatePresence>
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: dropPos.top,
                left: dropPos.left,
                width: dropPos.width,
                maxWidth: 320,
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderRadius: 16,
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                overflow: 'hidden',
              }}
              className="pointer-events-auto"
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari area..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] font-bold border-none focus:ring-2 focus:ring-blue-500/30 outline-none" />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-2">
                {filtered.map(a => (
                  <button key={a} type="button" onClick={() => { onChange(a); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selected === a ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColor(a)}`} />
                    <span className={`text-[11px] font-black uppercase flex-1 truncate ${selected === a ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {a === 'ALL' ? '✦ All Areas' : a}
                    </span>
                    {selected === a && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}

function CustomerDropdown({ customers, selected, onChange, highlighted = false }: { customers: string[]; selected: string; onChange: (v: string) => void; highlighted?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const isMob = window.innerWidth < 640;
      setDropPos({ 
        top: r.bottom + 8, 
        left: isMob ? Math.max(8, r.left) : r.left,
        width: Math.max(r.width, isMob ? window.innerWidth - 16 : 256)
      });
    }
    setOpen(v => !v);
  };

  const filtered = customers.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  const CUSTOMER_COLORS: Record<string, string> = {
    ALL: 'bg-slate-500', TAM: 'bg-blue-500', TMMIN: 'bg-red-500', YAMAHA: 'bg-indigo-500',
    HONDA: 'bg-red-600', GEELY: 'bg-emerald-500', SUZUKI: 'bg-orange-500', ISUZU: 'bg-cyan-500',
    MITSUBISHI: 'bg-violet-500', HYUNDAI: 'bg-blue-600', WULING: 'bg-rose-500',
  };
  const getColor = (c: string) => CUSTOMER_COLORS[c] || 'bg-slate-400';
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen} type="button"
        className={`flex items-center gap-2 pl-3 pr-3 py-2.5 bg-white dark:bg-slate-800 border rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm hover:border-blue-400 focus:ring-2 focus:ring-blue-500/30 min-w-[140px] w-full sm:w-auto ${
          highlighted
            ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-500/40 animate-pulse'
            : 'border-slate-200 dark:border-slate-700'
        }`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${getColor(selected)}`} />
        <span className="flex-1 text-left text-slate-700 dark:text-slate-200 truncate">{selected === 'ALL' ? 'ALL CUSTOMER' : selected}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-11000 pointer-events-none">
          <AnimatePresence>
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: dropPos.top,
                left: dropPos.left,
                width: dropPos.width,
                maxWidth: 320,
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderRadius: 16,
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                overflow: 'hidden',
              }}
              className="pointer-events-auto"
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari customer..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] font-bold border-none focus:ring-2 focus:ring-blue-500/30 outline-none" />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-2">
                {filtered.map(c => (
                  <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selected === c ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColor(c)}`} />
                    <span className={`text-[11px] font-black uppercase flex-1 truncate ${selected === c ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {c === 'ALL' ? '✦ All Customers' : c}
                    </span>
                    {selected === c && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}

function PersonnelDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const isMob = window.innerWidth < 640;
      setDropPos({ 
        top: r.bottom + 8, 
        left: isMob ? Math.max(8, r.left) : r.left,
        width: Math.max(r.width, isMob ? window.innerWidth - 16 : 208)
      });
    }
    setOpen(v => !v);
  };

  const options = [
    { value: 'ALL', label: 'All Personnel', icon: Users, color: 'text-slate-500', bg: 'bg-slate-500/10', dot: 'bg-slate-400' },
    { value: 'DRIVER', label: 'Drivers Only', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
    { value: 'ASST', label: 'Assistants Only', icon: Heart, color: 'text-emerald-500', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  ];
  const current = options.find(o => o.value === value) || options[0];
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen} type="button"
        className="flex items-center gap-2 pl-3 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm hover:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 min-w-[150px] w-full sm:w-auto">
        <div className={`w-2 h-2 rounded-full shrink-0 ${current.dot}`} />
        <span className="flex-1 text-left text-slate-700 dark:text-slate-200 truncate">{current.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-11000 pointer-events-none">
          <AnimatePresence>
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: dropPos.top,
                left: dropPos.left,
                width: dropPos.width,
                maxWidth: 320,
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderRadius: 16,
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                overflow: 'hidden',
              }}
              className="pointer-events-auto"
            >
              <div className="p-2">
                {options.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                        value === opt.value ? `${opt.bg} ${opt.color}` : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                      }`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${opt.bg}`}>
                        <Icon className={`w-4 h-4 ${opt.color}`} />
                      </div>
                      <p className="text-[11px] font-black uppercase flex-1 truncate">{opt.label}</p>
                      {value === opt.value && <CheckCircle2 className={`w-4 h-4 shrink-0 ${opt.color}`} />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}

function MetricPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{item.name}</p>
      <p className="text-sm font-black text-slate-900 dark:text-white">{item.percent.toFixed(1)}%</p>
      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{item.value} dari {item.total} cek</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label, labelKey, periodGranularity = 'day' }: any) {
  if (active && payload && payload.length) {
    const displayLabel = labelKey === 'period' && typeof label === 'string'
      ? tenkoService.formatTrendPeriodLabel(label, periodGranularity)
      : label;
    return (
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{displayLabel}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{p.name}</span>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
