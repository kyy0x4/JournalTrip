import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ticket, Activity, CheckCircle2, XCircle, AlertCircle, 
  Calendar, Search, Printer, Heart, ClipboardCheck, 
  AlertTriangle, User, Clock, Check, X, ShieldAlert,
  ChevronDown, RefreshCw, Eye
} from 'lucide-react';
import { fetchActiveDrivers } from '../services/dataFetcher';
import * as gatepassService from '../services/gatepassService';
import { Driver, P2HRecord } from '../types';
import { TenkoRecord } from '../services/tenkoService';
import Logo from '../image/Logo.png';
import AuthModal from '../components/auth/AuthModal';
import { supabase } from '../lib/supabase';
import { saveP2H, fetchP2HToday } from '../services/p2hService';
import P2HDocument from '../components/pdf/P2HDocument';
import TenkoDocument from '../components/pdf/TenkoDocument';

export default function GatepassPage() {
  const [selectedDate, setSelectedDate] = useState(() => 
    new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  );
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [printDateTime, setPrintDateTime] = useState('');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data Tenko dan P2H yang terisi hari ini
  const [tenkoRecords, setTenkoRecords] = useState<Record<string, TenkoRecord>>({});
  const [p2hRecords, setP2HRecords] = useState<Record<string, P2HRecord>>({});
  
  // Modals state
  const [selectedDriverForTenko, setSelectedDriverForTenko] = useState<Driver | null>(null);
  const [selectedDriverForP2H, setSelectedDriverForP2H] = useState<Driver | null>(null);
  const [activePrintDriver, setActivePrintDriver] = useState<Driver | null>(null);
  const [activePrintType, setActivePrintType] = useState<'GATEPASS' | 'P2H' | 'TENKO' | 'ALL' | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const executeWithAuth = async (action: () => void) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      action();
    } else {
      setPendingAction(() => action);
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };
  
  // Form P2H Manual
  const [p2hForm, setP2HForm] = useState({
    status: 'OK' as 'OK' | 'NG',
    catatan: ''
  });

  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'READY' | 'PENDING' | 'BLOCKED'>('ALL');

  // Load drivers & their Tenko/P2H records
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch scheduled drivers for selected date and shift
      const activeDrivers = await fetchActiveDrivers(selectedDate, 'ALL', selectedShift === 'ALL' ? undefined : selectedShift);
      setDrivers(activeDrivers);
      
      // 2. Fetch P2H records for this date (dari Supabase Table p2h)
      const p2hMap = await fetchP2HToday(selectedDate);
      setP2HRecords(p2hMap);
      
      // 3. Fetch Tenko records for all active drivers in parallel
      const tenkoMap: Record<string, TenkoRecord> = {};
      if (activeDrivers && activeDrivers.length > 0) {
        await Promise.all(
          activeDrivers.map(async (d) => {
            const record = await gatepassService.getTenkoForDriverToday(d.id, d.name, selectedDate);
            if (record) {
              tenkoMap[d.id] = record;
            }
          })
        );
      }
      setTenkoRecords(tenkoMap);
    } catch (e: any) {
      console.error('Error loading gatepass page data:', e);
      setError(e.message || String(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedShift]);

  // Helper evaluasi status kesehatan Tenko
  const getTenkoStatus = (driverId: string): { status: 'OK' | 'NG' | 'PENDING'; details?: string; record?: TenkoRecord } => {
    const record = tenkoRecords[driverId];
    if (!record) return { status: 'PENDING' };
    
    const isHipertensi = record.sistolik >= 145 || record.diastolik >= 90;
    const isHipotensi = record.sistolik < 90 || record.diastolik < 60;
    const isDemam = record.suhu_tubuh >= 37.5;
    const isPositifAlkohol = Number(record.alkohol) > 0;
    const isLelah = record.fatigue?.toUpperCase() === 'LELAH';
    
    if (isHipertensi) return { status: 'NG', details: 'Hipertensi', record };
    if (isHipotensi) return { status: 'NG', details: 'Hipotensi', record };
    if (isDemam) return { status: 'NG', details: 'Suhu Tinggi', record };
    if (isPositifAlkohol) return { status: 'NG', details: 'Positif Alkohol', record };
    if (isLelah) return { status: 'NG', details: 'Fatigue/Lelah', record };
    
    return { status: 'OK', details: 'Kondisi Sehat', record };
  };

  // Helper evaluasi status P2H
  const getP2HStatus = (driverId: string): { status: 'OK' | 'NG' | 'PENDING'; record?: P2HRecord } => {
    const record = p2hRecords[driverId];
    if (!record) return { status: 'PENDING' };
    return { status: record.status, record };
  };

  // Status Gatepass secara keseluruhan
  const getGatepassStatus = (driverId: string): 'READY' | 'PENDING' | 'BLOCKED' => {
    const tenko = getTenkoStatus(driverId);
    const p2h = getP2HStatus(driverId);
    
    if (tenko.status === 'NG' || p2h.status === 'NG') return 'BLOCKED';
    if (tenko.status === 'OK' && p2h.status === 'OK') return 'READY';
    return 'PENDING';
  };

  // Filter & Search Drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      // 1. Search Query
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            d.noPolisi?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            d.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      
      // 2. Filter Status
      const gpStatus = getGatepassStatus(d.id);
      if (filterStatus === 'ALL') return true;
      return gpStatus === filterStatus;
    });
  }, [drivers, searchQuery, filterStatus, tenkoRecords, p2hRecords]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    let total = drivers.length;
    let ready = 0;
    let pending = 0;
    let blocked = 0;
    
    drivers.forEach(d => {
      const status = getGatepassStatus(d.id);
      if (status === 'READY') ready++;
      else if (status === 'BLOCKED') blocked++;
      else pending++;
    });
    
    return { total, ready, pending, blocked };
  }, [drivers, tenkoRecords, p2hRecords]);

  // Simpan Input P2H Manual
  const handleSaveP2H = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverForP2H) return;
    setSaving(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const rawUser = session?.user?.email?.split('@')[0] || 'Mekanik'; // Ambil nama dari email
      const formattedUser = rawUser
        .split(/[\._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const newRecord = {
        tanggal: selectedDate,
        driver_id: selectedDriverForP2H.id,
        nopol: selectedDriverForP2H.noPolisi || '--',
        checked_by: formattedUser,
        status: p2hForm.status as 'OK' | 'NG',
        catatan: p2hForm.catatan
      };

      const res = await saveP2H(newRecord);
      
      if (res.success && res.data) {
        setP2HRecords(prev => ({
          ...prev,
          [selectedDriverForP2H.id]: res.data!
        }));
      }
      
      setSelectedDriverForP2H(null);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  // Pemicu Cetak
  const handlePrint = async (driver: Driver, type: 'GATEPASS' | 'P2H' | 'TENKO' | 'ALL') => {
    // Buka tab baru SECARA SINKRON untuk menghindari Popup Blocker browser
    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      pdfWindow.document.write(`
        <html><head><title>Menyiapkan PDF...</title></head>
        <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155;">
          <div style="width: 40px; height: 40px; border: 4px solid #ef4444; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
          <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 2px;">Memproses Dokumen</h2>
          <p style="font-size: 14px; color: #64748b;">Mohon tunggu, sedang merender PDF...</p>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </body></html>
      `);
    }

    const now = new Date();
    const formatted = `${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')} WIB`;
    setPrintDateTime(formatted);
    setActivePrintDriver(driver);
    setActivePrintType(type);
    setIsExportingPDF(true);

    try {
      // Wait for DOM to fully render all documents
      await new Promise(resolve => setTimeout(resolve, 1000));

      const capture = async (elId: string, w: number, h: number): Promise<string> => {
        console.log(`Mulai capture: ${elId}`);
        const el = document.getElementById(elId);
        if (!el) throw new Error(`Element #${elId} not found`);
        
        // Dynamically import html-to-image
        const htmlToImage = await import('html-to-image');
        
        // Timeout to prevent infinite hang
        const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`Timeout capture ${elId}`)), 10000));
        
        const capturePromise = htmlToImage.toJpeg(el, { 
          quality: 0.95, 
          backgroundColor: '#ffffff', 
          width: w, 
          height: h, 
          pixelRatio: 2
        });

        const result = await Promise.race([capturePromise, timeoutPromise]);
        console.log(`Berhasil capture: ${elId}`);
        return result;
      };

      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf');
      
      let finalPdf: InstanceType<typeof jsPDF> | null = null;

      if (type === 'ALL') {
        // Capture all 3 sequentially
        const gpData = await capture('gatepass-print-document', 800, 800);
        const tenkoData = await capture('tenko-print-document', 794, 1123);
        const p2hData = await capture('p2h-print-document', 794, 1123);

        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [210, 210] });
        finalPdf.addImage(gpData, 'JPEG', 0, 0, 210, 210);
        finalPdf.addPage('a4', 'p');
        finalPdf.addImage(tenkoData, 'JPEG', 0, 0, 210, 297);
        finalPdf.addPage('a4', 'p');
        finalPdf.addImage(p2hData, 'JPEG', 0, 0, 210, 297);

      } else if (type === 'GATEPASS') {
        const gpData = await capture('gatepass-print-document', 800, 800);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [210, 210] });
        finalPdf.addImage(gpData, 'JPEG', 0, 0, 210, 210);

      } else if (type === 'TENKO') {
        const tenkoData = await capture('tenko-print-document', 794, 1123);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        finalPdf.addImage(tenkoData, 'JPEG', 0, 0, 210, 297);

      } else if (type === 'P2H') {
        const p2hData = await capture('p2h-print-document', 794, 1123);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        finalPdf.addImage(p2hData, 'JPEG', 0, 0, 210, 297);
      }

      if (finalPdf) {
        const blobUrl = finalPdf.output('bloburl');
        if (pdfWindow) {
          pdfWindow.location.href = blobUrl as unknown as string;
        } else {
          // Fallback if popup blocker completely blocked the synchronous window.open
          // Try simulated click trick without download attribute to force opening in a new tab
          const link = document.createElement('a');
          link.href = blobUrl as unknown as string;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      if (pdfWindow) pdfWindow.close();
      alert(`Gagal mencetak. Error: ${(error as Error).message}`);
    } finally {
      setActivePrintDriver(null);
      setActivePrintType(null);
      setIsExportingPDF(false);
    }
  };
  useEscapeKey(() => setIsAuthModalOpen(false), !!isAuthModalOpen);


  return (
    <div className="space-y-6 pb-20">
      {/* ── HEADER PANEL ── */}
      <div className="print:hidden bg-white dark:bg-slate-900/60 backdrop-blur-xl p-4 md:p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-red-500/5 relative z-10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20 text-white shrink-0">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Gatepass Control Room</h1>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
                <ClipboardCheck className="w-3.5 h-3.5 text-red-500" />
                Readiness Verification &amp; Dispatcher Center
              </p>
            </div>
          </div>

          {/* Selektor Tanggal & Shift & Refresh */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Shift Selector */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-full sm:w-auto">
              {(['ALL', 'DAY', 'NIGHT'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedShift(s)}
                  className={`flex-1 sm:w-16 py-1.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    selectedShift === s 
                      ? 'bg-white dark:bg-slate-750 text-red-650 dark:text-red-400 shadow-sm font-black' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 font-bold'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 flex-1 sm:flex-none">
              <Calendar className="w-4 h-4 text-red-500" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-xs font-black focus:ring-0 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              />
            </div>
            
            <button 
              onClick={loadData}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all rounded-2xl text-slate-500 border border-slate-200/40 dark:border-slate-700/40"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS SUMMARY ── */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/40 dark:border-slate-800/40">
          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Scheduled</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total} <span className="text-xs font-bold text-slate-400">Drivers</span></p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/40 dark:border-slate-800/40">
          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Siap Operasional (OK)</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.ready} <span className="text-xs font-bold text-slate-400">Drivers</span></p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/40 dark:border-slate-800/40">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Pemeriksaan Tertunda</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.pending} <span className="text-xs font-bold text-slate-400">Drivers</span></p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/40 dark:border-slate-800/40">
          <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Tidak Siap Operasional (NG)</p>
          <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{stats.blocked} <span className="text-xs font-bold text-slate-400">Drivers</span></p>
        </div>
      </div>

      {/* ── FILTER & QUEUE PANEL ── */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-4xl p-6 shadow-xl border border-slate-100 dark:border-slate-800/50 min-h-128">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-red-600 rounded-full" />
            Antrean Dispatch Hari Ini
          </h3>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Status Filter buttons */}
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
              {[
                { id: 'ALL', label: 'SEMUA' },
                { id: 'READY', label: 'SIAP' },
                { id: 'PENDING', label: 'PENDING' },
                { id: 'BLOCKED', label: 'NG' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilterStatus(item.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                    filterStatus === item.id
                      ? 'bg-slate-900 text-white dark:bg-slate-700'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari driver / nopol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500/40 w-full sm:w-60 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ── QUEUE LIST ── */}
        {error && (
          <div className="mb-6 p-5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-start gap-4 shadow-xl shadow-rose-500/5">
            <AlertTriangle className="w-6 h-6 shrink-0 text-rose-500 animate-pulse" />
            <div className="flex-1">
              <p className="font-black uppercase tracking-wider text-xs">Error Loading Active Drivers</p>
              <p className="text-[11px] font-bold mt-1 text-rose-500/80 leading-relaxed">{error}</p>
              <div className="mt-3 flex gap-2">
                <button 
                  onClick={loadData}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Coba Lagi (Retry)
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mengambil data antrean harian...</p>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-3xl">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-850 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            </div>
            <p className="text-slate-400 dark:text-slate-500 font-bold">Tidak ada driver dalam antrean aktif.</p>
            <p className="text-xs text-slate-400/70 mt-1">Coba sesuaikan tanggal, shift, atau kata kunci pencarian Anda.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800 font-black uppercase tracking-widest text-[9px] bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="px-6 py-4 rounded-l-2xl">Driver</th>
                    <th className="px-6 py-4">Unit / Nopol</th>
                    <th className="px-6 py-4 text-center">Tenko (Kesehatan)</th>
                    <th className="px-6 py-4 text-center">P2H (Kelayakan)</th>
                    <th className="px-6 py-4 text-right rounded-r-2xl">Status Gatepass</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {filteredDrivers.map(driver => {
                    const tenko = getTenkoStatus(driver.id);
                    const p2h = getP2HStatus(driver.id);
                    const gpStatus = getGatepassStatus(driver.id);
                    
                    return (
                      <tr key={driver.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-850/20 transition-colors">
                        {/* Driver info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {driver.avatar ? (
                              <img src={driver.avatar} alt={driver.name} className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm">
                                <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                              </div>
                            )}
                            <div>
                              <p className="font-black text-slate-900 dark:text-white text-sm">{driver.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">NIK: {driver.nik || `#${driver.id.slice(0,6)}`}</p>
                            </div>
                          </div>
                        </td>

                        {/* Nopol */}
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-slate-900 dark:text-white uppercase">
                            {driver.noPolisi || '--'}
                          </span>
                        </td>

                        {/* Tenko status */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            {tenko.status === 'OK' ? (
                              <button className="inline-flex items-center px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-1 transition-transform cursor-default">
                                <Check className="w-3.5 h-3.5" />
                                OK ({tenko.record?.tensi || 'N/A'})
                              </button>
                            ) : tenko.status === 'NG' ? (
                              <button className="inline-flex items-center px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-150 dark:border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-1 transition-transform cursor-default">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                NG ({tenko.details})
                              </button>
                            ) : (
                              <button className="inline-flex items-center px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-1 opacity-75 cursor-not-allowed">
                                <AlertCircle className="w-3.5 h-3.5" />
                                PENDING (TIM TENKO)
                              </button>
                            )}
                          </div>
                        </td>

                        {/* P2H status */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            {p2h.status === 'OK' ? (
                              <button 
                                onClick={() => {
                                  setSelectedDriverForP2H(driver);
                                  setP2HForm({ status: 'OK', catatan: p2h.record?.catatan || '' });
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-1 hover:scale-105 transition-transform"
                              >
                                <Check className="w-3.5 h-3.5" />
                                OK
                              </button>
                            ) : p2h.status === 'NG' ? (
                              <button 
                                onClick={() => {
                                  setSelectedDriverForP2H(driver);
                                  setP2HForm({ status: 'NG', catatan: p2h.record?.catatan || '' });
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-150 dark:border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-1 hover:scale-105 transition-transform"
                              >
                                <X className="w-3.5 h-3.5" />
                                NG
                              </button>
                            ) : (
                              <button 
                                onClick={() => executeWithAuth(() => {
                                  setSelectedDriverForP2H(driver);
                                  setP2HForm({ status: 'OK', catatan: '' });
                                })}
                                className="inline-flex items-center px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-1 hover:scale-105 transition-transform"
                              >
                                <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                                PENDING
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Gatepass status badge */}
                        <td className="px-6 py-4 text-right">
                          {gpStatus === 'READY' ? (
                            <button
                              onClick={() => handlePrint(driver, 'ALL')}
                              disabled={isExportingPDF}
                              className="inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest hover:bg-emerald-500/25 active:scale-95 transition-all shadow-sm"
                            >
                              {isExportingPDF && activePrintDriver?.id === driver.id ? 'Loading...' : 'Siap Operasional'}
                            </button>
                          ) : gpStatus === 'BLOCKED' ? (
                            <span className="inline-flex px-3 py-1.5 rounded-full text-[9px] font-black bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/20 uppercase tracking-widest cursor-default">
                              Tidak Siap Operasional
                            </span>
                          ) : (
                            <span className="inline-flex px-3 py-1.5 rounded-full text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/30 dark:border-slate-700/30 uppercase tracking-widest cursor-default">
                              BELUM LENGKAP
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredDrivers.map(driver => {
                const tenko = getTenkoStatus(driver.id);
                const p2h = getP2HStatus(driver.id);
                const gpStatus = getGatepassStatus(driver.id);

                return (
                  <div 
                    key={driver.id} 
                    className="bg-slate-50/40 dark:bg-slate-850/15 border border-slate-100 dark:border-slate-800/50 rounded-3xl p-5 space-y-4 hover:shadow-md transition-all shadow-sm"
                  >
                    {/* Header: Driver Info & Nopol */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {driver.avatar ? (
                          <img src={driver.avatar} alt={driver.name} className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-850 shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm">
                            <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-black text-slate-900 dark:text-white text-sm">{driver.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{driver.noPolisi || '--'}</p>
                        </div>
                      </div>
                      
                      <span className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] shrink-0 border border-slate-200/20 dark:border-slate-700/20">
                        NIK: {driver.nik || `#${driver.id.slice(0,6)}`}
                      </span>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800/40" />

                    {/* Inspeksi Grid (Tenko & P2H) */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Tenko Area */}
                      <div className="flex flex-col items-center p-3 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tenko (Kesehatan)</p>
                        {tenko.status === 'OK' ? (
                          <button className="w-full inline-flex items-center justify-center px-2 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider gap-1 transition-transform cursor-default">
                            <Check className="w-3 h-3" />
                            OK ({tenko.record?.tensi || 'N/A'})
                          </button>
                        ) : tenko.status === 'NG' ? (
                          <button className="w-full inline-flex items-center justify-center px-2 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-155 dark:border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider gap-1 transition-transform cursor-default">
                            <ShieldAlert className="w-3 h-3" />
                            NG ({tenko.details})
                          </button>
                        ) : (
                          <button className="w-full inline-flex items-center justify-center px-2 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider gap-1 opacity-75 cursor-not-allowed">
                            <AlertCircle className="w-3 h-3" />
                            PENDING
                          </button>
                        )}
                      </div>

                      {/* P2H Area */}
                      <div className="flex flex-col items-center p-3 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">P2H (Kelayakan)</p>
                        {p2h.status === 'OK' ? (
                          <button 
                            onClick={() => {
                              setSelectedDriverForP2H(driver);
                              setP2HForm({ status: 'OK', catatan: p2h.record?.catatan || '' });
                            }}
                            className="w-full inline-flex items-center justify-center px-2 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            <Check className="w-3 h-3" />
                            OK
                          </button>
                        ) : p2h.status === 'NG' ? (
                          <button 
                            onClick={() => {
                              setSelectedDriverForP2H(driver);
                              setP2HForm({ status: 'NG', catatan: p2h.record?.catatan || '' });
                            }}
                            className="w-full inline-flex items-center justify-center px-2 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-155 dark:border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            <X className="w-3 h-3" />
                            NG
                          </button>
                        ) : (
                          <button 
                            onClick={() => executeWithAuth(() => {
                              setSelectedDriverForP2H(driver);
                              setP2HForm({ status: 'OK', catatan: '' });
                            })}
                            className="w-full inline-flex items-center justify-center px-2 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            <AlertCircle className="w-3 h-3 animate-pulse" />
                            PENDING
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800/40" />

                    {/* Footer: Gatepass Status */}
                    <div className="flex flex-col gap-1.5 pt-1">
                      <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status Gatepass</p>
                      {gpStatus === 'READY' ? (
                        <button
                          onClick={() => handlePrint(driver, 'ALL')}
                          disabled={isExportingPDF}
                          className="w-full inline-flex items-center justify-center px-3 py-2 rounded-2xl text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider hover:bg-emerald-500/25 active:scale-[0.98] transition-all shadow-sm"
                        >
                          {isExportingPDF && activePrintDriver?.id === driver.id ? 'Loading...' : 'Siap Operasional'}
                        </button>
                      ) : gpStatus === 'BLOCKED' ? (
                        <div className="w-full inline-flex items-center justify-center px-3 py-2 rounded-2xl text-[10px] font-black bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                          Tidak Siap Operasional
                        </div>
                      ) : (
                        <div className="w-full inline-flex items-center justify-center px-3 py-2 rounded-2xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/30 dark:border-slate-700/30 uppercase tracking-wider">
                          BELUM LENGKAP
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess} 
      />

      {/* ── MODAL INPUT P2H MANUAL ── */}
      {createPortal(
      <AnimatePresence>
        {selectedDriverForP2H && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDriverForP2H(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 z-10"
            >
              <form onSubmit={handleSaveP2H}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white">Pemeriksaan Kendaraan (P2H)</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Driver: {selectedDriverForP2H.name}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedDriverForP2H(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Status Kelayakan (OK / NG) */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center sm:text-left">
                      Hasil Kelayakan Unit Armada ({selectedDriverForP2H.noPolisi || 'No Plat'})
                    </label>
                    <div className="flex gap-4">
                      {/* OK Button */}
                      <button
                        type="button"
                        onClick={() => setP2HForm(prev => ({ ...prev, status: 'OK' }))}
                        className={`flex-1 py-4 px-6 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                          p2hForm.status === 'OK'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 font-black shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 font-bold hover:bg-slate-100/50'
                        }`}
                      >
                        <CheckCircle2 className="w-8 h-8 mb-2" />
                        <span className="text-xs uppercase tracking-widest font-black">ARMADA OK</span>
                        <span className="text-[8px] opacity-70 mt-1 uppercase font-bold">Siap Jalan</span>
                      </button>

                      {/* NG Button */}
                      <button
                        type="button"
                        onClick={() => setP2HForm(prev => ({ ...prev, status: 'NG' }))}
                        className={`flex-1 py-4 px-6 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                          p2hForm.status === 'NG'
                            ? 'bg-rose-500/15 border-rose-500 text-rose-600 font-black shadow-lg shadow-rose-500/10'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 font-bold hover:bg-slate-100/50'
                        }`}
                      >
                        <XCircle className="w-8 h-8 mb-2" />
                        <span className="text-xs uppercase tracking-widest font-black">ARMADA NG</span>
                        <span className="text-[8px] opacity-70 mt-1 uppercase font-bold">Tahan / Ada Rusak</span>
                      </button>
                    </div>
                  </div>

                  {/* Catatan / Keterangan Masalah */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Catatan / Keterangan Kerusakan
                    </label>
                    <textarea
                      placeholder={p2hForm.status === 'NG' ? "Sebutkan komponen yang bermasalah (contoh: Ban kiri botak, Lampu rem mati)..." : "Catatan opsional mengenai kelayakan kendaraan..."}
                      value={p2hForm.catatan}
                      onChange={(e) => setP2HForm(prev => ({ ...prev, catatan: e.target.value }))}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none placeholder:text-slate-400 resize-none"
                    />
                  </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setSelectedDriverForP2H(null)}
                    className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/25 disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Kelayakan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── PRINT OVERLAY (loading spinner only) ── */}
      {activePrintDriver && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Mencetak Dokumen...</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2">Sedang menyiapkan {activePrintType === 'ALL' ? '3 lembar PDF' : 'dokumen PDF'}</p>
          </div>
        </div>,
        document.body
      )}

      {/* ── OFF-SCREEN PRINT DOCUMENTS (fixed, outside overlay, not clipped) ── */}
      {activePrintDriver && (
        <div className="absolute top-0 left-0 opacity-0 pointer-events-none z-[-9999]">

          {/* Gatepass */}
          {(activePrintType === 'GATEPASS' || activePrintType === 'ALL') && (
            <div id="gatepass-print-document" className="w-[800px] h-[800px] flex flex-col bg-white text-slate-900 p-10">
              
              {/* Header Surat */}
              <div className="flex justify-between items-start border-b-4 border-double border-slate-900 pb-4 mb-6">
                <div className="w-[220px] shrink-0">
                  <img src={Logo} alt="K Line" className="h-8 object-contain" />
                </div>
                <div className="text-center flex-1 pt-1.5">
                  <h1 className="text-3xl font-black uppercase tracking-widest text-slate-900">GATE PASS</h1>
                </div>
                <div className="w-[220px] shrink-0 text-[8px] font-semibold text-slate-500 leading-normal text-right">
                  <p>Jl. Sultan Agung Km.28</p>
                  <p>Bekasi Barat 17133</p>
                  <p>Telp. (021) 88861101-03</p>
                </div>
              </div>

              {/* Nomor Surat & Tanggal */}
              <div className="flex justify-between items-center text-xs mb-6">
                <div>
                  <p className="font-bold text-slate-500 uppercase text-[9px]">Nomor Dokumen:</p>
                  <p className="font-black text-slate-900 uppercase">
                    {(() => {
                      const idx = filteredDrivers.findIndex(d => d.id === activePrintDriver.id);
                      const seq = (idx !== -1 ? idx + 1 : 1).toString().padStart(3, '0');
                      return `KRW/GP/${selectedDate.replace(/-/g, '')}/${seq}`;
                    })()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-500 uppercase text-[9px]">Tanggal &amp; Jam:</p>
                  <p className="font-black text-slate-900">
                    {printDateTime}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Driver Detail */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">Data Pengemudi</h4>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="py-1 text-slate-500 w-20">Nama:</td>
                        <td className="py-1 font-black text-slate-900">{activePrintDriver.name}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-500">NIK:</td>
                        <td className="py-1 font-bold text-slate-900">{activePrintDriver.nik || '--'}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-500">Status SIM:</td>
                        <td className="py-1 font-black text-emerald-600">
                          {activePrintDriver.simStatus === 'Valid' ? 'Berlaku' : (activePrintDriver.simStatus || 'Berlaku')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Armada Detail */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">Data Kendaraan</h4>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="py-1 text-slate-500 w-20">No. Polisi:</td>
                        <td className="py-1 font-black text-slate-900">{activePrintDriver.noPolisi || '--'}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-500">Base Pool:</td>
                        <td className="py-1 font-bold text-slate-900">KIIC</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-500">Dedicated:</td>
                        <td className="py-1 font-bold text-slate-900">TAM</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

          {/* Ringkasan Hasil Pemeriksaan Kesehatan & Unit */}
          <div className="space-y-4 mb-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">Verifikasi Kelayakan</h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Hasil Kesehatan */}
              <div className="p-4 border border-emerald-500 bg-emerald-500/5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">TENKO HEALTH CHECK</span>
                </div>
                <p className="text-xl font-black text-emerald-700">LULUS (OK)</p>
                <div className="text-[10px] space-y-1 text-slate-700">
                  <p>Tensi Darah: <span className="font-bold">{getTenkoStatus(activePrintDriver.id).record?.tensi || '120/80'} mmHg</span></p>
                  <p>Suhu Tubuh: <span className="font-bold">{getTenkoStatus(activePrintDriver.id).record?.suhu_tubuh || '36.5'} °C</span></p>
                  <p>Alkohol: <span className="font-bold">NEGATIF (0.00%)</span></p>
                  <p>Fisik &amp; Mata: <span className="font-bold">NORMAL / CLEAR</span></p>
                </div>
              </div>

              {/* Hasil P2H */}
              <div className="p-4 border border-emerald-500 bg-emerald-500/5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">P2H FLEET CHECK</span>
                </div>
                <p className="text-xl font-black text-emerald-700">LULUS (OK)</p>
                <div className="text-[10px] space-y-1 text-slate-700">
                  <p>Status Inspeksi: <span className="font-bold">ARMADA LAYAK JALAN</span></p>
                  <p className="line-clamp-2">Catatan: <span className="font-bold italic">"{getP2HStatus(activePrintDriver.id).record?.catatan || 'Kondisi kendaraan sangat prima'}"</span></p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic mb-6 text-center">
            Pernyataan: Dengan diterbitkannya dokumen ini, pengemudi dan armada di atas dinyatakan telah memenuhi standar keselamatan K Line dan diizinkan melakukan perjalanan ritase hari ini.
          </p>

          {/* Area Tanda Tangan */}
          <div className="grid grid-cols-3 gap-6 text-center text-xs relative z-10 mt-auto">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-12">Petugas Tenko</p>
              <div className="h-px bg-slate-900 mx-4" />
              <p className="font-black text-slate-900 mt-1 capitalize">{getTenkoStatus(activePrintDriver.id).record?.tim_tenko || 'Petugas Tenko'}</p>
            </div>
            <div className="flex flex-col items-center justify-center -mt-6">
              {/* Removed barcode as requested */}
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-12">Petugas P2H (Mekanik)</p>
              <div className="h-px bg-slate-900 mx-4" />
              <p className="font-black text-slate-900 mt-1 uppercase">{getP2HStatus(activePrintDriver.id).record?.checked_by || 'PETUGAS P2H'}</p>
            </div>
          </div>

          {/* Cap Resmi Digital Cap K LINE */}
          <div className="absolute bottom-16 left-12 w-28 h-28 border-4 border-dashed border-red-600/30 rounded-full flex items-center justify-center pointer-events-none rotate-12 -z-10 select-none">
            <div className="text-center text-[8px] font-black text-red-600/30 uppercase tracking-widest">
              <p>PT. KMI</p>
              <p className="text-xs border-y border-red-650/20 py-0.5 my-0.5">APPROVED</p>
              <p>LOGISTICS</p>
            </div>
          </div>

            </div>
          )}

          {(activePrintType === 'P2H' || activePrintType === 'ALL') && (
            <P2HDocument
              driverName={activePrintDriver.name}
              nopol={activePrintDriver.noPolisi || ''}
              date={selectedDate}
              checklist={p2hRecords[activePrintDriver.id]?.checklist || {}}
              checkerName={p2hRecords[activePrintDriver.id]?.checked_by || 'Admin'}
              catatan={p2hRecords[activePrintDriver.id]?.catatan || ''}
            />
          )}

          {(activePrintType === 'TENKO' || activePrintType === 'ALL') && (
            tenkoRecords[activePrintDriver.id]
              ? <TenkoDocument tenko={tenkoRecords[activePrintDriver.id]} />
              : <div id="tenko-print-document" className="bg-white w-[794px] h-[1123px] p-10 font-bold flex items-center justify-center">Data Tenko tidak tersedia</div>
          )}
        </div>
      )}
    </div>
  );
}

// DROPDOWN COMPONENT DROPDOWN UTILITIES FOR AREA AND CUSTOMER (LIKE IN TENKO PAGE)
interface DropdownProps {
  selected: string;
  onChange: (val: string) => void;
}

function AreaDropdown({ areas, selected, onChange }: DropdownProps & { areas: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div ref={ref} className="relative select-none shrink-0 overflow-visible">
      <button 
        type="button" 
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl py-2 px-3 flex items-center justify-between text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 gap-3 outline-none hover:bg-slate-200/50 transition-colors"
      >
        <span className="truncate">{selected === 'ALL' ? 'WILAYAH: ALL' : selected}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-450 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 8 }} 
            className="absolute top-full right-0 sm:-right-4 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 z-20 min-w-40 overflow-hidden"
          >
            {areas.map(a => (
              <button 
                key={a} 
                type="button" 
                onClick={() => { onChange(a); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-[10px] font-black uppercase ${selected === a ? 'bg-slate-100 dark:bg-slate-700 text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                {a === 'ALL' ? 'WILAYAH: ALL' : a}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
