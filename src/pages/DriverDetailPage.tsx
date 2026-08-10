import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Shield, 
  MapPin, 
  Truck, 
  User, 
  Calendar,
  AlertTriangle,
  BarChart3,
  Search,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  TrendingUp,
  Activity,
  X,
  Printer,
  Heart,
  ClipboardCheck,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { fetchDriverProfile } from '../services/dataFetcher';
import { fetchEcoViolations, EcoViolation } from '../services/ecoDataFetcher';
import { Driver, Ritase } from '../types';
import RitaseItem from '../components/dashboard/RitaseItem';
import * as gatepassService from '../services/gatepassService';
import { TenkoRecord, TENSI_FAKTOR_OPTIONS, isHipertensi, formatTensiFaktorDisplay } from '../services/tenkoService';
import { P2HRecord } from '../types';
import Logo from '../image/Logo.png';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import AuthModal from '../components/auth/AuthModal';
import { supabase } from '../lib/supabase';
import { TrainingMonthlyRecord } from '../types';
import { getTrainingByDriverId } from '../services/trainingService';

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 7)); // YYYY-MM
  const [driver, setDriver] = useState<Driver | null>(location.state?.driver || null);
  const [ritases, setRitases] = useState<(Ritase & { tanggal: string })[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingMonthlyRecord[]>([]);
  const [ecoViolations, setEcoViolations] = useState<EcoViolation[]>([]);
  const [showEcoModal, setShowEcoModal] = useState(false);
  const [ecoPage, setEcoPage] = useState(1);
  const ecoItemsPerPage = 5;
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // States for Tenko & P2H
  const [tenkoRecord, setTenkoRecord] = useState<TenkoRecord | null>(null);
  const [p2hRecord, setP2HRecord] = useState<P2HRecord | null>(null);
  const [showTenkoModal, setShowTenkoModal] = useState(false);
  const [showP2HModal, setShowP2HModal] = useState(false);
  const [tenkoForm, setTenkoForm] = useState({
    sistolik: 120,
    diastolik: 80,
    suhu: 36.5,
    alkohol: 0,
    fatigue: 'NORMAL' as 'NORMAL' | 'LELAH',
    tensi_faktor: '',
    tensi_keterangan: '',
  });
  const [p2hForm, setP2HForm] = useState({
    status: 'OK' as 'OK' | 'NG',
    catatan: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // States for Auth & Printing
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [printDateTime, setPrintDateTime] = useState('');
  const [activePrintDriver, setActivePrintDriver] = useState<Driver | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const getTenkoStatus = useCallback((): { status: 'OK' | 'NG' | 'PENDING'; details?: string } => {
    if (!tenkoRecord) return { status: 'PENDING' };
    const isHipertensiVal = isHipertensi(tenkoRecord.sistolik, tenkoRecord.diastolik);
    const isHipotensi = tenkoRecord.sistolik < 90 || tenkoRecord.diastolik < 60;
    const isDemam = tenkoRecord.suhu_tubuh >= 37.5;
    const isPositifAlkohol = Number(tenkoRecord.alkohol) > 0;
    const isLelah = tenkoRecord.fatigue?.toUpperCase() === 'LELAH';
    
    if (isHipertensiVal) {
      const faktor = formatTensiFaktorDisplay(tenkoRecord);
      return { status: 'NG', details: faktor ? `Hipertensi — ${faktor}` : 'Hipertensi' };
    }
    if (isHipotensi) return { status: 'NG', details: 'Hipotensi' };
    if (isDemam) return { status: 'NG', details: 'Suhu Tinggi' };
    if (isPositifAlkohol) return { status: 'NG', details: 'Positif Alkohol' };
    if (isLelah) return { status: 'NG', details: 'Fatigue/Lelah' };
    
    return { status: 'OK', details: 'Sehat' };
  }, [tenkoRecord]);

  const getP2HStatus = useCallback((): 'OK' | 'NG' | 'PENDING' => {
    if (!p2hRecord) return 'PENDING';
    return p2hRecord.status;
  }, [p2hRecord]);

  const getGatepassStatus = useCallback((): 'READY' | 'PENDING' | 'BLOCKED' => {
    const tenko = getTenkoStatus();
    const p2h = getP2HStatus();
    if (tenko.status === 'NG' || p2h === 'NG') return 'BLOCKED';
    if (tenko.status === 'OK' && p2h === 'OK') return 'READY';
    return 'PENDING';
  }, [getTenkoStatus, getP2HStatus]);

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

  const handleSaveTenko = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    setIsSaving(true);
    try {
      const hipertensi = isHipertensi(tenkoForm.sistolik, tenkoForm.diastolik);
      if (hipertensi && !tenkoForm.tensi_faktor) {
        alert('Pilih faktor hipertensi sebelum menyimpan.');
        setIsSaving(false);
        return;
      }
      if (hipertensi && tenkoForm.tensi_faktor === 'Lainnya' && !tenkoForm.tensi_keterangan.trim()) {
        alert('Isi keterangan faktor untuk opsi Lainnya.');
        setIsSaving(false);
        return;
      }

      const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const tensiStr = `${tenkoForm.sistolik}/${tenkoForm.diastolik}`;
      
      const newRecord = {
        tanggal: todayStr,
        driver_id: driver.id,
        nama_driver: driver.name,
        nopol: driver.noPolisi || '--',
        tensi: tensiStr,
        sistolik: tenkoForm.sistolik,
        diastolik: tenkoForm.diastolik,
        suhu_tubuh: tenkoForm.suhu,
        alkohol: tenkoForm.alkohol,
        fatigue: tenkoForm.fatigue,
        tensi_faktor: hipertensi ? tenkoForm.tensi_faktor : null,
        tensi_keterangan: hipertensi && tenkoForm.tensi_keterangan.trim() ? tenkoForm.tensi_keterangan.trim() : null,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        tim_tenko: 'Tim Tenko (Self Check)'
      };

      const res = await gatepassService.saveManualTenkoRecord(newRecord);
      setTenkoRecord(res);
      setShowTenkoModal(false);
    } catch (err) {
      console.error('Error saving Tenko:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveP2H = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    setIsSaving(true);
    try {
      const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const { data: { session } } = await supabase.auth.getSession();
      const rawUser = session?.user?.email?.split('@')[0] || 'Mekanik';
      const formattedUser = rawUser
        .split(/[\._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const newRecord = {
        tanggal: todayStr,
        driver_id: driver.id,
        nopol: driver.noPolisi || '--',
        checked_by: formattedUser,
        status: p2hForm.status as 'OK' | 'NG',
        catatan: p2hForm.catatan
      };

      const res = await gatepassService.saveP2HRecord(newRecord);
      if (res.success && res.data) {
        setP2HRecord(res.data);
      }
      setShowP2HModal(false);
    } catch (err) {
      console.error('Error saving P2H:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!driver) return;
    const now = new Date();
    const formatted = `${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')} WIB`;
    setPrintDateTime(formatted);
    setActivePrintDriver(driver);
    setIsExportingPDF(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = document.getElementById('gatepass-print-document');
      if (!element) throw new Error("Elemen dokumen cetak tidak ditemukan.");

      const dataUrl = await htmlToImage.toJpeg(element, {
        quality: 0.9,
        backgroundColor: '#ffffff',
        width: 800,
        height: 800,
        pixelRatio: 2
      });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [210, 210]
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 210);
      const blobUrl = pdf.output('bloburl');
      window.open(blobUrl as unknown as string, '_blank');

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal mencetak Gatepass. Silakan coba lagi.');
    } finally {
      setActivePrintDriver(null);
      setIsExportingPDF(false);
    }
  };

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const data = await fetchDriverProfile(id, selectedMonth);
    if (data) {
      setDriver(data.driver);
      setRitases(data.ritases);
      
      const driverId = data.driver.id;
      const driverName = data.driver.name;

      // Load Training
      const trainingData = await getTrainingByDriverId(driverId);
      setTrainingRecords(trainingData);

      // Load Tenko & P2H for today
      const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const tenkoVal = await gatepassService.getTenkoForDriverToday(driverId, driverName, todayStr);
      setTenkoRecord(tenkoVal);
      if (tenkoVal) {
        setTenkoForm({
          sistolik: tenkoVal.sistolik || 120,
          diastolik: tenkoVal.diastolik || 80,
          suhu: tenkoVal.suhu_tubuh || 36.5,
          alkohol: Number(tenkoVal.alkohol) || 0,
          fatigue: (tenkoVal.fatigue?.toUpperCase() === 'LELAH' ? 'LELAH' : 'NORMAL') as 'NORMAL' | 'LELAH',
          tensi_faktor: tenkoVal.tensi_faktor || '',
          tensi_keterangan: tenkoVal.tensi_keterangan || '',
        });
      } else {
        setTenkoForm({
          sistolik: 120,
          diastolik: 80,
          suhu: 36.5,
          alkohol: 0,
          fatigue: 'NORMAL',
          tensi_faktor: '',
          tensi_keterangan: '',
        });
      }
      
      const p2hVal = await gatepassService.getP2HRecord(driverId, todayStr);
      setP2HRecord(p2hVal);
      if (p2hVal) {
        setP2HForm({
          status: p2hVal.status,
          catatan: p2hVal.catatan || ''
        });
      } else {
        setP2HForm({
          status: 'OK',
          catatan: ''
        });
      }
      
      // Comprehensive Month Map for multi-language support
      const MONTH_MAP: Record<string, number> = { 
        'Jan': 0, 'January': 0, 'Januari': 0, 'Feb': 1, 'February': 1, 'Februari': 1,
        'Mar': 2, 'March': 2, 'Maret': 2, 'Apr': 3, 'April': 3, 'May': 4, 'Mei': 4,
        'Jun': 5, 'June': 5, 'Juni': 5, 'Jul': 6, 'July': 6, 'Juli': 6,
        'Aug': 7, 'August': 7, 'Agustus': 7, 'Agu': 7, 'Agt': 7, 'Sep': 8, 'September': 8,
        'Oct': 9, 'October': 9, 'Oktober': 9, 'Okt': 9, 'Nov': 10, 'November': 10,
        'Dec': 11, 'December': 11, 'Desember': 11, 'Des': 11
      };

      const parseViolationDate = (vDate: string) => {
        if (!vDate) return null;
        const parts = vDate.split(/[\s-]/); 
        if (parts.length !== 3) return null;
        let mStr = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
        const monthIdx = MONTH_MAP[mStr];
        if (monthIdx === undefined) return null;
        const rawYear = parseInt(parts[2]);
        const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
        return new Date(fullYear, monthIdx, parseInt(parts[0]));
      };

      const ecoData = await fetchEcoViolations({
        driverId: driverId,
        driverName: driverName
      });

      const [targetY, targetM] = selectedMonth.split('-');
      const targetMonthIdx = parseInt(targetM) - 1;
      const targetYear = parseInt(targetY);

      const driverViolations = ecoData
        .map(v => ({ ...v, _parsedDate: parseViolationDate(v.tanggal) }))
        .filter(v => {
          const isThisDriver = v.driver_id === driverId || v.pengemudi?.toLowerCase() === driverName.toLowerCase();
          if (!isThisDriver) return false;
          if (!v._parsedDate) return false;
          return v._parsedDate.getMonth() === targetMonthIdx && v._parsedDate.getFullYear() === targetYear;
        }) as (EcoViolation & { _parsedDate: Date })[];
      
      setEcoViolations(driverViolations);
    }
    setIsLoading(false);
  }, [id, selectedMonth]);

  useEffect(() => {
    loadProfile();
    setCurrentPage(1); // Reset page on month change
  }, [loadProfile]);

  const toggleRitase = (ritaseId: string | number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(ritaseId)) {
        next.delete(ritaseId);
      } else {
        next.add(ritaseId);
      }
      return next;
    });
  };

  // Pagination logic
  const totalPages = Math.ceil(ritases.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ritases.slice(indexOfFirstItem, indexOfLastItem);

  // Group current items by date
  const groupedRitases = currentItems.reduce((acc: Record<string, (Ritase & { tanggal: string })[]>, curr) => {
    if (!acc[curr.tanggal]) acc[curr.tanggal] = [];
    acc[curr.tanggal].push(curr);
    return acc;
  }, {} as Record<string, (Ritase & { tanggal: string })[]>);

  useEscapeKey(() => setShowEcoModal(false), !!showEcoModal);
  useEscapeKey(() => setShowTenkoModal(false), !!showTenkoModal);
  useEscapeKey(() => setIsAuthModalOpen(false), !!isAuthModalOpen);

  if (isLoading && !driver) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Back button skeleton */}
        <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        
        <div className="bg-white dark:bg-slate-900 rounded-4xl md:rounded-6xl overflow-hidden shadow-2xl pb-12">
          {/* Hero background skeleton */}
          <div className="h-40 md:h-64 bg-slate-100 dark:bg-slate-800" />
          
          <div className="px-6 md:px-12 -mt-16 md:-mt-24 relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-10">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-[40px] bg-slate-200 dark:bg-slate-800 ring-8 ring-white dark:ring-slate-900" />
              <div className="flex-1 pb-4">
                <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl mb-3" />
                <div className="flex gap-2">
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
              </div>
            </div>

            {/* Stats skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
              ))}
            </div>

            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
              <div className="lg:col-span-2 h-96 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!driver) return <div>Driver not found</div>;

  return (
    <div className="space-y-6">
      {/* ── BACK BUTTON & NAVIGATION ── */}
      <button 
        onClick={() => navigate('/drivers')}
        className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors font-bold text-sm group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back to Data
      </button>

      {/* ── PROFILE HERO ── */}
      <div className="relative bg-white dark:bg-slate-900 rounded-4xl md:rounded-6xl overflow-hidden shadow-2xl">
        {/* Header Background */}
        <div className="h-40 md:h-64 bg-linear-to-br from-red-600 via-red-700 to-red-900 dark:bg-linear-to-br dark:from-slate-900 dark:via-slate-950 dark:to-black relative overflow-hidden">
          <div className="absolute inset-0 hidden dark:block bg-[radial-gradient(at_top_right,rgba(220,38,38,0.2)_0%,transparent_50%)]" />
          <div className="absolute inset-0 dark:hidden bg-[radial-gradient(at_top_left,rgba(255,255,255,0.15)_0%,transparent_60%)]" />
          
          {/* Animated Elements */}
          <motion.div
            animate={{ x: [-50, 400, -50], y: [0, -10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/3 left-0 text-white/20 text-4xl"
          >
            🚚
          </motion.div>
          
          <div className="absolute inset-0 bg-linear-to-t from-black/30 dark:from-black/50 to-transparent" />
        </div>

        {/* Profile Content */}
        <div className="px-6 md:px-12 pb-10 -mt-16 md:-mt-24 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-10">
            {driver.avatar ? (
              <img src={driver.avatar} alt={driver.name} className="w-32 h-32 md:w-48 md:h-48 rounded-[40px] object-cover ring-8 ring-white dark:ring-slate-900 shadow-2xl" />
            ) : (
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-[40px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-8 ring-white dark:ring-slate-900 shadow-xl">
                <User className="w-16 h-16 text-slate-300" />
              </div>
            )}
            <div className="pb-4 text-center md:text-left">
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2">{driver.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase">DRIVER AKTIF</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-sm">BASE POOL A</span>
              </div>
            </div>
          </div>

          {/* ── READINESS SCORECARD PANEL ── */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[32px] border border-slate-200/50 dark:border-slate-800/60 shadow-lg shadow-red-500/5 mb-10">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-red-500" />
              Status Kesiapan Operasional Harian
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Tenko Health Check */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px]">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">1. Pemeriksaan Kesehatan</span>
                    <Heart className="w-4 h-4 text-red-500" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white mb-3">Tenko Health Check</h4>
                </div>
                
                <div className="flex justify-between items-center gap-2">
                  {(() => {
                    const tenko = getTenkoStatus();
                    if (tenko.status === 'OK') {
                      return (
                        <>
                          <div className="flex flex-col">
                            <span className="inline-flex items-center text-xs font-black text-emerald-600 dark:text-emerald-450 uppercase tracking-wider gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              LULUS (OK)
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold mt-0.5">Tensi: {tenkoRecord?.tensi || 'N/A'}, Suhu: {tenkoRecord?.suhu_tubuh || 'N/A'}°C</span>
                          </div>
                          <button
                            onClick={() => setShowTenkoModal(true)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl text-[9px] font-black uppercase text-slate-600 dark:text-slate-350 transition-all border border-slate-200/30"
                          >
                            Update
                          </button>
                        </>
                      );
                    } else if (tenko.status === 'NG') {
                      return (
                        <>
                          <div className="flex flex-col">
                            <span className="inline-flex items-center text-xs font-black text-rose-550 dark:text-rose-400 uppercase tracking-wider gap-1">
                              <ShieldAlert className="w-4 h-4" />
                              DITAHAN (NG)
                            </span>
                            <span className="text-[9px] text-rose-400 font-bold mt-0.5">{tenko.details}</span>
                          </div>
                          <button
                            onClick={() => setShowTenkoModal(true)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl text-[9px] font-black uppercase text-slate-600 dark:text-slate-355 transition-all border border-slate-200/30"
                          >
                            Update
                          </button>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <span className="inline-flex items-center text-xs font-black text-amber-500 uppercase tracking-wider gap-1">
                            <AlertCircle className="w-4 h-4 animate-pulse" />
                            BELUM DIISI
                          </span>
                          <button
                            onClick={() => setShowTenkoModal(true)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/10 active:scale-95"
                          >
                            Isi Tenko
                          </button>
                        </>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Card 2: P2H Fleet Check */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px]">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">2. Kelayakan Kendaraan</span>
                    <Truck className="w-4 h-4 text-sky-500" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white mb-3">P2H Fleet Check</h4>
                </div>
                
                <div className="flex justify-between items-center gap-2">
                  {(() => {
                    const p2h = getP2HStatus();
                    if (p2h === 'OK') {
                      return (
                        <>
                          <div className="flex flex-col">
                            <span className="inline-flex items-center text-xs font-black text-emerald-600 dark:text-emerald-450 uppercase tracking-wider gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              LAYAK (OK)
                            </span>
                            {p2hRecord?.catatan && (
                              <span className="text-[9px] text-slate-400 font-bold mt-0.5 truncate max-w-[150px]">{p2hRecord.catatan}</span>
                            )}
                          </div>
                          <button
                            onClick={() => executeWithAuth(() => setShowP2HModal(true))}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl text-[9px] font-black uppercase text-slate-600 dark:text-slate-350 transition-all border border-slate-200/30"
                          >
                            Update
                          </button>
                        </>
                      );
                    } else if (p2h === 'NG') {
                      return (
                        <>
                          <div className="flex flex-col">
                            <span className="inline-flex items-center text-xs font-black text-rose-550 dark:text-rose-400 uppercase tracking-wider gap-1">
                              <XCircle className="w-4 h-4" />
                              RUSAK (NG)
                            </span>
                            {p2hRecord?.catatan && (
                              <span className="text-[9px] text-rose-400 font-bold mt-0.5 truncate max-w-[150px]">{p2hRecord.catatan}</span>
                            )}
                          </div>
                          <button
                            onClick={() => executeWithAuth(() => setShowP2HModal(true))}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl text-[9px] font-black uppercase text-slate-600 dark:text-slate-355 transition-all border border-slate-200/30"
                          >
                            Update
                          </button>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <span className="inline-flex items-center text-xs font-black text-amber-500 uppercase tracking-wider gap-1">
                            <AlertCircle className="w-4 h-4 animate-pulse" />
                            BELUM DIISI
                          </span>
                          <button
                            onClick={() => executeWithAuth(() => setShowP2HModal(true))}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/10 active:scale-95"
                          >
                            Isi P2H
                          </button>
                        </>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Card 3: Gatepass Status & Printing */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px] md:border-l-4 md:border-l-red-500">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">3. Surat Izin Keluar Armada</span>
                    <Printer className="w-4 h-4 text-red-500" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white mb-3">Gatepass Izin Jalan</h4>
                </div>
                
                <div>
                  {(() => {
                    const gpStatus = getGatepassStatus();
                    if (gpStatus === 'READY') {
                      return (
                        <button
                          onClick={handlePrint}
                          disabled={isExportingPDF}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 uppercase tracking-widest hover:bg-emerald-500/25 active:scale-[0.98] transition-all shadow-sm shrink-0"
                        >
                          {isExportingPDF ? 'Loading...' : 'Siap Operasional / Cetak'}
                        </button>
                      );
                    } else if (gpStatus === 'BLOCKED') {
                      return (
                        <div className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-[10px] font-black bg-rose-500/15 text-rose-550 dark:text-rose-400 border border-rose-500/20 uppercase tracking-widest cursor-default">
                          Tidak Siap Operasional
                        </div>
                      );
                    } else {
                      return (
                        <div className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/30 dark:border-slate-700/30 uppercase tracking-widest cursor-default">
                          BELUM LENGKAP
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ── SUMMARY STATS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Ritase</p>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{driver.totalRitaseMonth || 0} <span className="text-sm font-bold text-slate-400 italic">This Month</span></p>
            </div>

            <div 
              onClick={() => setShowEcoModal(true)}
              className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl shadow-sm cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all border border-transparent hover:border-orange-200"
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Pelanggaran</p>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {ecoViolations.length} 
                <span className="text-sm font-bold text-slate-400 italic ml-2">This Month</span>
              </p>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-orange-600 uppercase tracking-tighter">
                View Details <TrendingUp className="w-3 h-3" />
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status SIM</p>
              </div>
              <p className={`text-2xl font-black ${driver.simStatus === 'Valid' ? 'text-green-600' : 'text-rose-500'}`}>{driver.simStatus?.toUpperCase()}</p>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unit Utama</p>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{driver.noPolisi || '---'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Personal Data, Training, & Incidents */}
            <div className="space-y-6">
              {/* 1. Data Pribadi */}
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                Personal Registry
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 shadow-inner space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">NIK</p>
                  <p className="font-bold text-slate-900 dark:text-white">{driver.nik || '---'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alamat</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{driver.alamat || '---'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Telpon</p>
                  <p className="font-bold text-slate-900 dark:text-white">{driver.phone || '08xx-xxxx-xxxx'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">SIM Expiry</p>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {driver.simExpiry ? new Date(driver.simExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '---'}
                  </p>
                </div>
              </div>

              {/* 2. Data Training */}
              <div className="pt-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Training Records
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  
                  {/* Radar Chart */}
                  {(() => {
                    const getTrainingScore = (months: string[]) => {
                      const records = [...trainingRecords].reverse().filter(r => months.includes(r.bulan) && r.post_test > 0);
                      if (records.length === 0) return 0;
                      return records[0].post_test;
                    };

                    const radarData = [
                      { subject: 'SOP', score: getTrainingScore(['JAN', 'FEB']), fullMark: 100 },
                      { subject: 'Kiken Yochi', score: getTrainingScore(['MAR', 'APR', 'NOV', 'DEC']), fullMark: 100 },
                      { subject: 'Defensive Driving', score: getTrainingScore(['MAY', 'JUN']), fullMark: 100 },
                      { subject: 'Basic Safety', score: getTrainingScore(['JUL', 'AUG']), fullMark: 100 },
                      { subject: 'Eco Driving', score: getTrainingScore(['SEP']), fullMark: 100 },
                      { subject: 'Traffic Reg', score: getTrainingScore(['OCT']), fullMark: 100 },
                    ];

                    return (
                      <div className="h-64 w-full mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} label={{ fill: '#0f172a', fontSize: 12, fontWeight: 900, position: 'outside' }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                              itemStyle={{ fontWeight: 'bold', color: '#3b82f6' }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                      <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Kehadiran Q1</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {trainingRecords.filter(r => ['JAN', 'FEB', 'MAR'].includes(r.bulan)).reduce((acc, curr) => acc + (curr.kehadiran || 0), 0)} <span className="text-sm text-slate-400">Sesi</span>
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                      <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Kehadiran Q2</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {trainingRecords.filter(r => ['APR', 'MAY', 'JUN'].includes(r.bulan)).reduce((acc, curr) => acc + (curr.kehadiran || 0), 0)} <span className="text-sm text-slate-400">Sesi</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Latest Training</p>
                    {(() => {
                      const latest = [...trainingRecords].reverse().find(r => r.post_test > 0 || r.kehadiran > 0);
                      if (!latest) return <p className="text-xs text-slate-500 italic">Belum ada data training</p>;
                      return (
                        <div>
                          <p className="text-xs font-bold text-slate-500">{latest.tanggal_training || `Bulan ${latest.bulan}`}</p>
                          <p className="font-black text-slate-900 dark:text-white mb-2">Defensive & Eco Driving Awareness</p>
                          
                          <div className="flex gap-4">
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Post Test</p>
                              <p className="font-black text-lg text-emerald-500">{latest.post_test}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Status</p>
                              {latest.kelulusan === 'L' ? (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-[10px] font-black tracking-wider">LULUS (L)</span>
                              ) : latest.kelulusan === 'TL' ? (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded text-[10px] font-black tracking-wider">TIDAK LULUS (TL)</span>
                              ) : (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 rounded text-[10px] font-black tracking-wider">BELUM DIKETAHUI</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 3. Data Broken SOP / Incident */}
              <div className="pt-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  Incident & SOP Records
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                    <ShieldAlert className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Clear Record</p>
                  <p className="text-[10px] text-slate-400">Belum ada data pelanggaran atau insiden</p>
                </div>
              </div>

              {/* Eco Driving Summary Card (Dipindah ke bawah) */}
              <div className="pt-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  Eco Driving Summary
                </h3>
                <div 
                  onClick={() => setShowEcoModal(true)}
                  className="bg-linear-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Activity className="w-32 h-32 text-white" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Safety Performance</p>
                    <h4 className="text-2xl font-black text-white mb-4">Analysis Report</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total Incidents</p>
                        <p className="text-xl font-black text-white">{ecoViolations.length}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-right">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Trend Status</p>
                        <p className={`text-xs font-black ${ecoViolations.length > 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {ecoViolations.length > 5 ? 'High Risk' : 'Healthy'}
                        </p>
                      </div>
                    </div>
                    <button className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest transition-all border border-white/5">
                      Open Detailed Analysis
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Journal Trip History */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-600 rounded-full" />
                  Journal Trip History
                </h3>
                
                {/* Month Picker Solution */}
                <div 
                  onClick={() => monthInputRef.current?.showPicker()}
                  className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  <div className="px-3 py-1.5 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-red-500" />
                    <input 
                      ref={monthInputRef}
                      type="month" 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent border-none text-xs font-black text-slate-900 dark:text-white focus:ring-0 cursor-pointer outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Ritase History List with Min Height for Stability */}
              <div className="space-y-8 min-h-212.5">
                {Object.keys(groupedRitases).length > 0 ? (
                  (Object.entries(groupedRitases) as [string, (Ritase & { tanggal: string })[]][]).map(([date, trips]) => (
                    <div key={date} className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {trips.map((ritase) => (
                          <RitaseItem 
                            key={ritase.id} 
                            ritase={ritase} 
                            isExpanded={expandedIds.has(ritase.id)}
                            onToggle={() => toggleRitase(ritase.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center bg-slate-50 dark:bg-slate-800/20 rounded-4xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 font-bold">No trips recorded for this month</p>
                  </div>
                )}
              </div>

              {/* ── PAGINATION ── */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 pt-8">
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 min-w-[320px] justify-between px-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all outline-none"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                    
                    <div className="flex items-center justify-center flex-1">
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1;
                        if (
                          pageNum === 1 || 
                          pageNum === totalPages || 
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-10 h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center outline-none ${
                                currentPage === pageNum 
                                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/30' 
                                  : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                          return <span key={pageNum} className="px-1 text-slate-300 dark:text-slate-600 font-black">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all outline-none"
                    >
                      <ChevronRightIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>
                  
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, ritases.length)} of {ritases.length} Trips
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* ── ECO DRIVING DETAIL MODAL ── */}
      {createPortal(
      <AnimatePresence>
        {showEcoModal && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEcoModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-y-auto border border-slate-200/60 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                      <Activity className="w-8 h-8 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white">Eco Driving Analysis</h3>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Detail Pelanggaran & Tren Mengemudi</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowEcoModal(false)}
                    className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Analysis Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                  <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-4xl border border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Violation Trend</h4>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-sky-500" />
                          <span className="text-[9px] font-black text-slate-500 uppercase">Pelanggaran</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={(() => {
                          const daily = (ecoViolations as any[]).reduce((acc: any, v) => {
                            if (!v._parsedDate) return acc;
                            const day = v._parsedDate.getDate();
                            acc[day] = (acc[day] || 0) + 1;
                            return acc;
                          }, {});
                          // Generate array for all days in month
                          return Array.from({ length: 31 }, (_, i) => ({
                            day: i + 1,
                            count: daily[i + 1] || 0
                          }));
                        })()}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.1} />
                            <XAxis 
                              dataKey="day" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                              interval={4}
                              tickFormatter={(val) => val}
                            />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 p-3 rounded-2xl shadow-2xl border border-slate-800">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">
                                      {label} {new Date(selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-sky-500 rounded-full" />
                                      <p className="text-sm font-black text-white">{payload[0].value} <span className="text-[10px] text-slate-400">Pelanggaran</span></p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area 
                            name="Jumlah Pelanggaran"
                            type="monotone" 
                            dataKey="count" 
                            stroke="#0ea5e9" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 bg-sky-50 dark:bg-sky-950/20 rounded-3xl border border-sky-100 dark:border-sky-900/30">
                      <p className="text-[10px] font-black text-sky-600 uppercase mb-1">Most Frequent</p>
                      <h5 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {(() => {
                          const counts: any = {};
                          ecoViolations.forEach(v => counts[v.jenis_peringatan] = (counts[v.jenis_peringatan] || 0) + 1);
                          return Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'None';
                        })()}
                      </h5>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Violation Breakdown</p>
                      <div className="space-y-3">
                        {['Akselerasi', 'Perlambatan', 'Kecepatan', 'Tikungan'].map(cat => {
                          const count = ecoViolations.filter(v => v.jenis_peringatan.includes(cat)).length;
                          const pct = ecoViolations.length ? (count / ecoViolations.length) * 100 : 0;
                          return (
                            <div key={cat}>
                              <div className="flex justify-between text-[9px] font-black uppercase mb-1">
                                <span className="text-slate-500">{cat}</span>
                                <span className="text-slate-900 dark:text-white">{count}</span>
                              </div>
                              <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Historical Events</h4>
                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-4xl overflow-hidden border border-slate-100 dark:border-slate-800 mb-6">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Waktu</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Jenis Pelanggaran</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Lokasi</th>
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {ecoViolations.slice((ecoPage - 1) * ecoItemsPerPage, ecoPage * ecoItemsPerPage).map((v, i) => (
                        <tr key={i} className="hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-black text-slate-900 dark:text-white">
                              {(v as any)._parsedDate?.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) || '---'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{v.waktu}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                              v.jenis_peringatan.toLowerCase().includes('akselerasi') ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                              v.jenis_peringatan.toLowerCase().includes('perlambatan') ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                              v.jenis_peringatan.toLowerCase().includes('kecepatan') ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                v.jenis_peringatan.toLowerCase().includes('akselerasi') ? 'bg-orange-500' :
                                v.jenis_peringatan.toLowerCase().includes('perlambatan') ? 'bg-rose-500' :
                                v.jenis_peringatan.toLowerCase().includes('kecepatan') ? 'bg-amber-500' :
                                'bg-blue-500'
                              }`} />
                              {v.jenis_peringatan}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-500 dark:text-slate-400 line-clamp-1 text-[10px]">{v.lokasi}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-black text-slate-900 dark:text-white">{v.plat_nomor}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Eco Pagination */}
                {ecoViolations.length > ecoItemsPerPage && (
                  <div className="flex justify-center items-center gap-2 mb-8">
                    <button 
                      disabled={ecoPage === 1}
                      onClick={() => setEcoPage(p => p - 1)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(ecoViolations.length / ecoItemsPerPage)) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setEcoPage(pageNum)}
                            className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                              ecoPage === pageNum 
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-400/20' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button 
                      disabled={ecoPage >= Math.ceil(ecoViolations.length / ecoItemsPerPage)}
                      onClick={() => setEcoPage(p => p + 1)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center sticky bottom-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Data updated monthly from telematics logs.</p>
                <button 
                  onClick={() => setShowEcoModal(false)}
                  className="px-8 py-3 bg-red-600 rounded-2xl text-xs font-black text-white shadow-xl shadow-red-500/30 hover:bg-red-700 transition-all uppercase tracking-widest"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── MODAL INPUT TENKO MANUAL ── */}
      {createPortal(
      <AnimatePresence>
        {showTenkoModal && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTenkoModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800 z-10"
            >
              <form onSubmit={handleSaveTenko}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white">Pemeriksaan Kesehatan (Tenko)</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Driver: {driver.name}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowTenkoModal(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Tensi Darah: Sistolik & Diastolik */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Tekanan Darah Sistolik
                      </label>
                      <input
                        type="number"
                        required
                        min={50}
                        max={250}
                        value={tenkoForm.sistolik}
                        onChange={(e) => setTenkoForm(prev => {
                          const sistolik = parseInt(e.target.value) || 120;
                          const stillHipertensi = isHipertensi(sistolik, prev.diastolik);
                          return {
                            ...prev,
                            sistolik,
                            tensi_faktor: stillHipertensi ? prev.tensi_faktor : '',
                            tensi_keterangan: stillHipertensi ? prev.tensi_keterangan : '',
                          };
                        })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Tekanan Darah Diastolik
                      </label>
                      <input
                        type="number"
                        required
                        min={30}
                        max={180}
                        value={tenkoForm.diastolik}
                        onChange={(e) => setTenkoForm(prev => {
                          const diastolik = parseInt(e.target.value) || 80;
                          const stillHipertensi = isHipertensi(prev.sistolik, diastolik);
                          return {
                            ...prev,
                            diastolik,
                            tensi_faktor: stillHipertensi ? prev.tensi_faktor : '',
                            tensi_keterangan: stillHipertensi ? prev.tensi_keterangan : '',
                          };
                        })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none"
                      />
                    </div>
                  </div>

                  {isHipertensi(tenkoForm.sistolik, tenkoForm.diastolik) && (
                    <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                      <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                        Hipertensi Terdeteksi — Isi Faktor
                      </p>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Faktor Hipertensi *
                        </label>
                        <select
                          required
                          value={tenkoForm.tensi_faktor}
                          onChange={(e) => setTenkoForm(prev => ({ ...prev, tensi_faktor: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none"
                        >
                          <option value="">— Pilih Faktor —</option>
                          {TENSI_FAKTOR_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Keterangan {tenkoForm.tensi_faktor === 'Lainnya' ? '*' : '(Opsional)'}
                        </label>
                        <textarea
                          rows={2}
                          value={tenkoForm.tensi_keterangan}
                          onChange={(e) => setTenkoForm(prev => ({ ...prev, tensi_keterangan: e.target.value }))}
                          placeholder="Detail faktor / kondisi driver..."
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Suhu Tubuh */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Suhu Tubuh (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      min={34}
                      max={42}
                      value={tenkoForm.suhu}
                      onChange={(e) => setTenkoForm(prev => ({ ...prev, suhu: parseFloat(e.target.value) || 36.5 }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none"
                    />
                  </div>

                  {/* Alkohol Level */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Kadar Alkohol (BAC %)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0}
                      max={5}
                      value={tenkoForm.alkohol}
                      onChange={(e) => setTenkoForm(prev => ({ ...prev, alkohol: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 outline-none"
                    />
                  </div>

                  {/* Fatigue Status */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Kelelahan (Fatigue)
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setTenkoForm(prev => ({ ...prev, fatigue: 'NORMAL' }))}
                        className={`flex-1 py-3 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                          tenkoForm.fatigue === 'NORMAL'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        Bebas Lelah (Normal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTenkoForm(prev => ({ ...prev, fatigue: 'LELAH' }))}
                        className={`flex-1 py-3 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                          tenkoForm.fatigue === 'LELAH'
                            ? 'bg-rose-500/10 border-rose-500 text-rose-650'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        Mengantuk / Lelah
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowTenkoModal(false)}
                    className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-350 active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-3 bg-red-650 hover:bg-red-750 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/25 disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Tenko'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── MODAL INPUT P2H MANUAL ── */}
      {createPortal(
      <AnimatePresence>
        {showP2HModal && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowP2HModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800 z-10"
            >
              <form onSubmit={handleSaveP2H}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white">Pemeriksaan Kendaraan (P2H)</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Driver: {driver.name}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowP2HModal(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Status Kelayakan (OK / NG) */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center sm:text-left">
                      Hasil Kelayakan Unit Armada ({driver.noPolisi || 'No Plat'})
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
                    onClick={() => setShowP2HModal(false)}
                    className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-350 active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/25 disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Kelayakan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess} 
      />

      {/* ── PRINT COMPONENT (Only renders during print) ── */}
      {activePrintDriver && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden">
          {/* Overlay loading information */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center relative z-10 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Mencetak Gatepass...</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2">Sedang menyiapkan dokumen PDF</p>
          </div>

          {/* Wrapper to handle positioning and centering without affecting the capture offset */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-0 pointer-events-none">
            {/* Actual Print Document - Fixed 800x800 Square Layout for custom paper formats */}
            <div id="gatepass-print-document" className="w-[800px] h-[800px] flex flex-col bg-white text-slate-900 p-10 border border-slate-200 opacity-100">
              
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
                      const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                      const datePart = todayStr.replace(/-/g, '');
                      const seq = (driver.id.charCodeAt(0) % 100).toString().padStart(3, '0');
                      return `KRW/GP/${datePart}/${seq}`;
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
                        <td className="py-1 font-black text-slate-900">{driver.name}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-500">NIK:</td>
                        <td className="py-1 font-bold text-slate-900">{driver.nik || '--'}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-500">Status SIM:</td>
                        <td className="py-1 font-black text-emerald-600">
                          {driver.simStatus === 'Valid' ? 'Berlaku' : (driver.simStatus || 'Berlaku')}
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
                        <td className="py-1 font-black text-slate-900">{driver.noPolisi || '--'}</td>
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
                      <p>Tensi Darah: <span className="font-bold">{tenkoRecord?.tensi || '120/80'} mmHg</span></p>
                      <p>Suhu Tubuh: <span className="font-bold">{tenkoRecord?.suhu_tubuh || '36.5'} °C</span></p>
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
                      <p className="line-clamp-2">Catatan: <span className="font-bold italic">"{p2hRecord?.catatan || 'Kondisi kendaraan sangat prima'}"</span></p>
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
                  <p className="font-black text-slate-900 mt-1 capitalize">{tenkoRecord?.tim_tenko || 'Petugas Tenko'}</p>
                </div>
                <div className="flex flex-col items-center justify-center -mt-6">
                  {/* cap placeholder */}
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-12">Petugas P2H (Mekanik)</p>
                  <div className="h-px bg-slate-900 mx-4" />
                  <p className="font-black text-slate-900 mt-1 uppercase">{p2hRecord?.checked_by || 'PETUGAS P2H'}</p>
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
          </div>
        </div>
      )}
    </div>
  );
}
