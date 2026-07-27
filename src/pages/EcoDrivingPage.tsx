import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { 
  Shield, Activity, Calendar, MapPin, Map as MapIcon, Leaf, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, BarChart3, AlertTriangle, AlertCircle, Filter, FilterX, Route, Clock, RefreshCw, X, Upload, Camera, Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchEcoViolations, computeDriverRankings, computeViolationsByDate, EcoViolation } from '../services/ecoDataFetcher';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Marker Icons for different violation types
const createCustomIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const iconMap = {
  'Akselerasi Mendadak': createCustomIcon('#3b82f6'), // Blue
  'Perlambatan Mendadak': createCustomIcon('#f59e0b'), // Amber
  'Kecepatan Melebihi Batas': createCustomIcon('#ef4444'), // Red
  'Tikungan Tajam': createCustomIcon('#8b5cf6'), // Purple
  'default': createCustomIcon('#64748b'), // slate-500
};

// Map Bounds Updater Component
const MapUpdater = ({ violations }: { violations: EcoViolation[] }) => {
  const map = useMap();
  useEffect(() => {
    if (violations.length > 0) {
      const validCoords = violations.map(v => {
        if (v.koordinat) {
          const parts = v.koordinat.split(',');
          if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) return [lat, lng] as [number, number];
          }
        }
        return null;
      }).filter(Boolean) as [number, number][];

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [violations, map]);
  return null;
};

function StatCard({ label, value, prevValue, icon: Icon, iconColor, iconBg, active, activeColor, onClick }: any) {
  const delta = value - (prevValue || 0);
  const isUp = delta > 0;
  const percentage = !prevValue ? (value > 0 ? 100 : 0) : Math.abs((delta / prevValue) * 100);

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border transition-all cursor-pointer ${
        active ? `${activeColor} ring-2 ring-opacity-20` : 'border-slate-100 dark:border-slate-800 hover:border-emerald-500'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <div className={`w-8 h-8 rounded-full ${iconBg} ${iconColor} flex items-center justify-center shadow-sm`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
        </div>
        {prevValue !== undefined && (
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-0.5 text-[10px] font-black ${isUp ? 'text-emerald-500' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {isUp ? <ChevronUp className="w-3 h-3" /> : delta < 0 ? <ChevronDown className="w-3 h-3" /> : null}
              {percentage.toFixed(1)}%
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">vs prev period</p>
          </div>
        )}
      </div>
    </div>
  );
}



export default function EcoDrivingPage({ isTAM = false }: { isTAM?: boolean }) {
    const now = new Date();
    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
    const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); // YYYY-MM Lokal
    const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')); // YYYY-MM-DD
    const [endDate, setEndDate] = useState(now.toLocaleDateString('en-CA')); // YYYY-MM-DD Lokal
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');
  const [selectedCabang, setSelectedCabang] = useState('ALL');
  const [violations, setViolations] = useState<EcoViolation[]>([]);
  const [prevViolations, setPrevViolations] = useState<EcoViolation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCoachingDriver, setSelectedCoachingDriver] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [coachingPhotoUrl, setCoachingPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedCoachingDriver) {
      const fetchPhoto = async () => {
        setIsLoadingPhoto(true);
        try {
          const { data } = await supabase.from('drivers').select('coaching_photo_url').eq('name', selectedCoachingDriver).single();
          if (data?.coaching_photo_url) {
             setCoachingPhotoUrl(data.coaching_photo_url);
          } else {
             setCoachingPhotoUrl(null);
          }
        } catch (e) {
          console.error(e);
          setCoachingPhotoUrl(null);
        }
        setIsLoadingPhoto(false);
      };
      fetchPhoto();
    } else {
      setCoachingPhotoUrl(null);
    }
  }, [selectedCoachingDriver]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCoachingDriver) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `coaching/${selectedCoachingDriver.replace(/\s+/g, '_')}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('coaching-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('coaching-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('drivers')
        .update({ coaching_photo_url: publicUrl })
        .eq('name', selectedCoachingDriver);

      if (updateError) throw updateError;

      setCoachingPhotoUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading coaching photo:', error);
      alert('Gagal upload foto coaching!');
    } finally {
      setIsUploading(false);
    }
  };

  
  // Custom Dropdown State
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [cabangDropdownOpen, setCabangDropdownOpen] = useState(false);
  const [areaPos, setAreaPos] = useState({ top: 0, left: 0, width: 0 });
  const [customerPos, setCustomerPos] = useState({ top: 0, left: 0, width: 0 });
  const [cabangPos, setCabangPos] = useState({ top: 0, left: 0, width: 0 });
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const customerBtnRef = useRef<HTMLButtonElement>(null);
  const cabangBtnRef = useRef<HTMLButtonElement>(null);
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const cabangDropdownRef = useRef<HTMLDivElement>(null);
  
  // Filtered areas based on isTAM
  // Note: SULAWESI is hidden from EcoDriving for TAM users only
  const filteredAreas = useMemo(() => {
    if (isTAM) {
      return [
        { val: 'ALL', label: 'Semua Area' },
        { val: 'JBK', label: 'JBK' },
        { val: 'NGORO', label: 'NGORO' },
        { val: 'SUMATERA', label: 'SUMATERA' },
        { val: 'PADANG', label: 'PADANG' },
        { val: 'KALIMANTAN', label: 'KALIMANTAN' },
      ];
    }
    return [
      { val: 'ALL', label: 'Semua Area' },
      { val: 'JBK', label: 'JBK' },
      { val: 'NGORO', label: 'NGORO' },
      { val: 'SUMATERA', label: 'SUMATERA' },
      // { val: 'SULAWESI', label: 'SULAWESI' }
    ];
  }, [isTAM, selectedCabang]);

  // Reset selectedArea if not compatible with selected branch (cabang)
  useEffect(() => {
    if (selectedArea !== 'ALL' && !filteredAreas.some(opt => opt.val === selectedArea)) {
      setSelectedArea('ALL');
    }
  }, [selectedCabang, filteredAreas, selectedArea]);

  // Cross-Filtering State
  const [cfDriver, setCfDriver] = useState<string | null>(null);
  const [cfType, setCfType] = useState<string | null>(null);
  const [cfDate, setCfDate] = useState<string | null>(null);
  
  // Pagination
  const [rankPage, setRankPage] = useState(1);
  const rankPerPage = 10;

  // Reload data when filters change (also handles initial load)
  useEffect(() => {
    loadData();
  }, [filterMode, selectedMonth, startDate, endDate, selectedArea, selectedCustomer, selectedCabang]);

  // Handle clicking outside custom dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (areaDropdownOpen && areaDropdownRef.current && !areaDropdownRef.current.contains(target) && areaBtnRef.current && !areaBtnRef.current.contains(target)) {
        setAreaDropdownOpen(false);
      }
      if (customerDropdownOpen && customerDropdownRef.current && !customerDropdownRef.current.contains(target) && customerBtnRef.current && !customerBtnRef.current.contains(target)) {
        setCustomerDropdownOpen(false);
      }
      if (cabangDropdownOpen && cabangDropdownRef.current && !cabangDropdownRef.current.contains(target) && cabangBtnRef.current && !cabangBtnRef.current.contains(target)) {
        setCabangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
  useEscapeKey(() => {
    if (selectedCoachingDriver) setSelectedCoachingDriver(null);
    if (cfDriver) setCfDriver(null);
  }, !!selectedCoachingDriver || !!cfDriver);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [areaDropdownOpen, customerDropdownOpen, cabangDropdownOpen]);

  // Clear cross-filters when main data changes
  useEffect(() => {
    setCfDriver(null);
    setCfType(null);
    setCfDate(null);
  }, [violations]);

  const getMonthFilters = (monthStr?: string, customStart?: Date, customEnd?: Date) => {
    const monthEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    const buildFilters = (month: number, year: number) => {
      const y2 = year.toString().slice(-2);
      const mEN = monthEN[month];
      const mID = monthID[month];
      return [
        `%-${mEN}-${y2}`, `%-${mID}-${y2}`,
        `% ${mEN} ${year}`, `% ${mID} ${year}`,
        `% ${mEN} ${y2}`, `% ${mID} ${y2}`,
      ];
    };

    if (customStart && customEnd) {
      const filters: string[] = [];
      let current = new Date(customStart.getFullYear(), customStart.getMonth(), 1);
      const last = new Date(customEnd.getFullYear(), customEnd.getMonth(), 1);
      while (current <= last) {
        filters.push(...buildFilters(current.getMonth(), current.getFullYear()));
        current.setMonth(current.getMonth() + 1);
      }
      return [...new Set(filters)];
    }

    if (filterMode === 'month') {
      const targetStr = monthStr || selectedMonth;
      const [y, m] = targetStr.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return [...new Set(buildFilters(d.getMonth(), d.getFullYear()))];
    } else {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const filters: string[] = [];
      let current = new Date(d1.getFullYear(), d1.getMonth(), 1);
      const last = new Date(d2.getFullYear(), d2.getMonth(), 1);
      while (current <= last) {
        filters.push(...buildFilters(current.getMonth(), current.getFullYear()));
        current.setMonth(current.getMonth() + 1);
      }
      return [...new Set(filters)];
    }
  };

  const parseViolationDate = (vDate: string) => {
    const MONTH_MAP: Record<string, number> = { 
      'Jan': 0, 'January': 0, 'Januari': 0, 'Feb': 1, 'February': 1, 'Februari': 1,
      'Mar': 2, 'March': 2, 'Maret': 2, 'Apr': 3, 'April': 3, 'May': 4, 'Mei': 4,
      'Jun': 5, 'June': 5, 'Juni': 5, 'Jul': 6, 'July': 6, 'Juli': 6,
      'Aug': 7, 'August': 7, 'Agustus': 7, 'Agu': 7, 'Agt': 7, 'Sep': 8, 'September': 8,
      'Oct': 9, 'October': 9, 'Oktober': 9, 'Okt': 9, 'Nov': 10, 'November': 10,
      'Dec': 11, 'December': 11, 'Desember': 11, 'Des': 11
    };
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

  const fetchIdRef = useRef(0);

  const loadData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setViolations([]);
    setPrevViolations([]);
    
    try {
      // 1. Fetch Current Period
      const mFilters = getMonthFilters();
      const promises = mFilters.map(f => fetchEcoViolations({
        area: selectedArea, customer: selectedCustomer, monthFilter: f, cabang: selectedCabang
      }));
      const results = await Promise.all(promises);
      let rawData = Array.from(new Map(results.flat().map((v: EcoViolation) => [v.id, v])).values());
      if (isTAM) {
        rawData = rawData.filter((v: EcoViolation) => {
          const area = (v.area || '').toUpperCase();
          const proj = (v.customer || (v as any).Customer || (v as any).project || '').toUpperCase();
          return !area.includes('SULAWESI') && !proj.includes('TMMIN');
        });
      }
      
      const optimize = (v: EcoViolation) => {
        const j = v.jenis_peringatan?.toLowerCase() || '';
        let optType = 'Lainnya';
        if (j.includes('akselerasi')) optType = 'Akselerasi';
        else if (j.includes('perlambatan')) optType = 'Perlambatan';
        else if (j.includes('kecepatan')) optType = 'Kecepatan';
        else if (j.includes('tikungan')) optType = 'Tikungan';
        return { ...v, _optimizedType: optType };
      };

      const filtered = (rawData as EcoViolation[]).filter((v: EcoViolation) => {
        const d = parseViolationDate(v.tanggal);
        if (!d) return false;
        if (filterMode === 'month') {
          const [y, m] = selectedMonth.split('-');
          const target = new Date(parseInt(y), parseInt(m) - 1, 1);
          return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
        } else {
          const start = new Date(startDate); start.setHours(0,0,0,0);
          const end = new Date(endDate); end.setHours(23,59,59,999);
          return d >= start && d <= end;
        }
      }).map(optimize);
      
      if (currentFetchId !== fetchIdRef.current) return;
      setViolations(filtered);

      // 2. Fetch Previous Period (Comparison)
      if (filterMode === 'month') {
        const [y, m] = selectedMonth.split('-');
        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
        d.setMonth(d.getMonth() - 1);
        const prevMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const prevFilters = getMonthFilters(prevMonthStr);
        const prevResults = await Promise.all(prevFilters.map(f => fetchEcoViolations({
          area: selectedArea, customer: selectedCustomer, monthFilter: f, cabang: selectedCabang
        })));
        const prevRaw = Array.from(new Map(prevResults.flat().map((v: EcoViolation) => [v.id, v])).values());
        const prevFiltered = (prevRaw as EcoViolation[]).filter(v => {
          const vd = parseViolationDate(v.tanggal);
          return vd && vd.getMonth() === d.getMonth() && vd.getFullYear() === d.getFullYear();
        }).map(optimize);
        
        if (currentFetchId !== fetchIdRef.current) return;
        setPrevViolations(prevFiltered);
      } else {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);
        const diff = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - diff);
        
        const prevFilters = getMonthFilters(undefined, prevStart, prevEnd);
        const prevResults = await Promise.all(prevFilters.map(f => fetchEcoViolations({
          area: selectedArea, customer: selectedCustomer, monthFilter: f, cabang: selectedCabang
        })));
        
        const prevRaw = Array.from(new Map(prevResults.flat().map((v: EcoViolation) => [v.id, v])).values());
        const prevFiltered = (prevRaw as EcoViolation[]).filter(v => {
          const vd = parseViolationDate(v.tanggal);
          return vd && vd >= prevStart && vd <= prevEnd;
        }).map(optimize);
        
        if (currentFetchId !== fetchIdRef.current) return;
        setPrevViolations(prevFiltered);
      }
      setRankPage(1);
    } catch (err) {
      console.error("Error loading eco data:", err);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  };


  const checkFilter = (v: any, checkDriver: boolean, checkType: boolean, checkDate: boolean) => {
    if (checkDriver && cfDriver && v.pengemudi !== cfDriver) return false;
    if (checkDate && cfDate && !v.tanggal.startsWith(cfDate)) return false;
    if (checkType && cfType && v._optimizedType !== cfType) return false;
    return true;
  };

  // Fully filtered for the Map & Total incident count
  const activeViolations = useMemo(() => violations.filter(v => checkFilter(v, true, true, true)), [violations, cfDriver, cfType, cfDate]);
  
  // For Driver Rankings / Top 10 (ignores cfDriver so context remains)
  const driverViolations = useMemo(() => violations.filter(v => checkFilter(v, false, true, true)), [violations, cfType, cfDate]);
  const rankings = useMemo(() => computeDriverRankings(driverViolations), [driverViolations]);
  
  // For Daily Trend Chart (ignores cfDate so context remains)
  const dateViolations = useMemo(() => violations.filter(v => checkFilter(v, true, true, false)), [violations, cfDriver, cfType]);
  const dateTrend = useMemo(() => computeViolationsByDate(dateViolations), [dateViolations]);
  const chartIsMonthly = dateTrend.length > 0 && !dateTrend[0]?.date?.match(/^\d/);
  
  // For Pie Chart & Scorecards (ignores cfType so context remains)
  const typeViolations = useMemo(() => violations.filter(v => checkFilter(v, true, false, true)), [violations, cfDriver, cfDate]);
  
  // Prepare data for Pie Chart
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    typeViolations.forEach(v => {
      const type = v._optimizedType || 'Lainnya';
      counts[type] = (counts[type] || 0) + 1;
    });
    const colors: any = { 'Akselerasi': '#3b82f6', 'Perlambatan': '#f59e0b', 'Kecepatan': '#ef4444', 'Tikungan': '#8b5cf6', 'Lainnya': '#64748b' };
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: colors[name] }));
  }, [typeViolations]);

  // Safe pie label renderer - defined outside JSX to avoid re-render crashes
  const renderPieLabel = ({ percent, x, y, cx }: any) => {
    if (!percent || percent < 0.03) return null;
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

  // Prepare data for Driver Bar Chart
  const driverBarData = useMemo(() => {
    const totalV = Math.max(1, driverViolations.length);
    return rankings.slice(0, 10).map((r, i) => ({
      name: r.driver.split(' ')[0] + '\u200B'.repeat(i), // Zero-width space trick for unique keys
      fullName: r.driver,
      total: r.total,
      pct: ((r.total / totalV) * 100).toFixed(1) + '%'
    }));
  }, [rankings, driverViolations.length]);

  const totalViolations = activeViolations.length;
  
  // Previous Period Filtering
  const activePrevViolations = useMemo(() => prevViolations.filter(v => checkFilter(v, true, true, true)), [prevViolations, cfDriver, cfType, cfDate]);
  const typePrevViolations = useMemo(() => prevViolations.filter(v => checkFilter(v, true, false, true)), [prevViolations, cfDriver, cfDate]);

  const countType = (typeStr: string, dataset = typeViolations) => dataset.filter(v => {
    const t = v._optimizedType?.toLowerCase() || '';
    return typeStr === 'perlambatan' ? t === 'perlambatan' : t === typeStr;
  }).length;

  return (
    <div id="pdf-export-content" className="space-y-6 pb-20">
      {/* ── HEADER & FILTERS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-4xl p-4 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
              <Leaf className="w-6 h-6 md:w-7 md:h-7 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Eco Driving</h1>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Fleet Safety Analytics</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto shadow-inner shrink-0">
              <button onClick={() => setFilterMode('month')} className={`flex-1 sm:w-24 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filterMode === 'month' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Bulan</button>
              <button onClick={() => setFilterMode('range')} className={`flex-1 sm:w-24 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filterMode === 'range' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tanggal</button>
            </div>

            <div className="grid grid-cols-1 sm:flex sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {filterMode === 'month' ? (
                <div className="relative group w-full sm:w-44">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><Calendar className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" /></div>
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} onClick={(e) => 'showPicker' in e.currentTarget && (e.currentTarget as any).showPicker()} onMouseDown={(e) => e.preventDefault()} className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500/50 outline-none uppercase tracking-widest transition-all cursor-pointer shadow-sm select-none" />
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm justify-center sm:justify-start">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => 'showPicker' in e.currentTarget && (e.currentTarget as any).showPicker()} onMouseDown={(e) => e.preventDefault()} className="flex-1 sm:flex-none w-full sm:w-auto bg-transparent text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest cursor-pointer select-none p-0" />
                  <span className="text-slate-400 font-bold text-xs shrink-0">-</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => 'showPicker' in e.currentTarget && (e.currentTarget as any).showPicker()} onMouseDown={(e) => e.preventDefault()} className="flex-1 sm:flex-none w-full sm:w-auto bg-transparent text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest cursor-pointer select-none p-0" />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 sm:flex sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative group w-full sm:w-auto">
                  <button
                    ref={cabangBtnRef}
                    onClick={() => {
                      if (cabangBtnRef.current) {
                        const r = cabangBtnRef.current.getBoundingClientRect();
                        const isMob = window.innerWidth < 640;
                        setCabangPos({ 
                          top: r.bottom + 8, 
                          left: isMob ? Math.max(8, r.left) : r.left,
                          width: Math.max(r.width, isMob ? window.innerWidth - 16 : 144)
                        });
                      }
                      setCabangDropdownOpen(!cabangDropdownOpen);
                    }}
                    className="w-full sm:w-36 flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm"
                  >
                    <span className="truncate">{selectedCabang === 'ALL' ? 'Cabang' : selectedCabang}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {cabangDropdownOpen && createPortal(
                    <div className="fixed inset-0 z-11000 pointer-events-none">
                      <AnimatePresence>
                        <motion.div
                          ref={cabangDropdownRef}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          style={{
                            position: 'fixed',
                            top: cabangPos.top,
                            left: cabangPos.left,
                            width: cabangPos.width,
                            maxWidth: 320,
                          }}
                          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1"
                        >
                          {[{ val: 'ALL', label: 'Semua Cabang' }, { val: 'KARAWANG', label: 'KARAWANG' }].map(opt => (
                            <button key={opt.val} onClick={() => { setSelectedCabang(opt.val); setCabangDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${selectedCabang === opt.val ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{opt.label}</button>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>,
                    document.body
                  )}
                </div>

                <div className="relative group w-full sm:w-auto">
                  <button
                    ref={areaBtnRef}
                    onClick={() => {
                      if (areaBtnRef.current) {
                        const r = areaBtnRef.current.getBoundingClientRect();
                        const isMob = window.innerWidth < 640;
                        setAreaPos({ 
                          top: r.bottom + 8, 
                          left: isMob ? Math.max(8, r.left) : r.left,
                          width: Math.max(r.width, isMob ? window.innerWidth - 16 : 144)
                        });
                      }
                      setAreaDropdownOpen(!areaDropdownOpen);
                    }}
                    className="w-full sm:w-36 flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm"
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
                          style={{
                            position: 'fixed',
                            top: areaPos.top,
                            left: areaPos.left,
                            width: areaPos.width,
                            maxWidth: 320,
                          }}
                          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1"
                        >
                          {filteredAreas.map(opt => (
                            <button key={opt.val} onClick={() => { setSelectedArea(opt.val); setAreaDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${selectedArea === opt.val ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{opt.label}</button>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>,
                    document.body
                  )}
                </div>

                <div className="relative group w-full sm:w-auto">
                  <button
                    ref={customerBtnRef}
                    onClick={() => {
                      if (customerBtnRef.current) {
                        const r = customerBtnRef.current.getBoundingClientRect();
                        const isMob = window.innerWidth < 640;
                        setCustomerPos({ 
                          top: r.bottom + 8, 
                          left: isMob ? Math.max(8, r.left) : r.left,
                          width: Math.max(r.width, isMob ? window.innerWidth - 16 : 160)
                        });
                      }
                      setCustomerDropdownOpen(!customerDropdownOpen);
                    }}
                    className="w-full sm:w-40 flex items-center justify-between pl-4 pr-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none uppercase tracking-widest transition-all shadow-sm"
                  >
                    <span className="truncate">{selectedCustomer === 'ALL' ? 'Customer' : selectedCustomer}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {customerDropdownOpen && createPortal(
                    <div className="fixed inset-0 z-11000 pointer-events-none">
                      <AnimatePresence>
                        <motion.div
                          ref={customerDropdownRef}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          style={{
                            position: 'fixed',
                            top: customerPos.top,
                            left: customerPos.left,
                            width: customerPos.width,
                            maxWidth: 320,
                          }}
                          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden pointer-events-auto py-1"
                        >
                          {(isTAM 
                            ? [{ val: 'ALL', label: 'Semua Customer' }, { val: 'TAM', label: 'TAM' }] 
                            : [{ val: 'ALL', label: 'Semua Customer' }, { val: 'TAM', label: 'TAM' }, { val: 'TMMIN', label: 'TMMIN' }]
                          ).map(opt => (
                            <button key={opt.val} onClick={() => { setSelectedCustomer(opt.val); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${selectedCustomer === opt.val ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{opt.label}</button>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>,
                    document.body
                  )}
                </div>

                <button onClick={loadData} disabled={isLoading} className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm shrink-0 group">
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : 'group-hover:-rotate-180 transition-transform duration-500'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      {/* Cross-Filter Indicator */}
      {(cfDriver || cfType || cfDate) && (
        <div className="flex flex-wrap items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <Filter className="w-4 h-4 shrink-0" />
          <span>Active Filter:</span>
          {cfDriver && <span className="bg-white dark:bg-emerald-900/50 px-2 py-1 rounded-lg shadow-sm">Driver: {cfDriver}</span>}
          {cfType && <span className="bg-white dark:bg-emerald-900/50 px-2 py-1 rounded-lg shadow-sm">Tipe: {cfType}</span>}
          {cfDate && <span className="bg-white dark:bg-emerald-900/50 px-2 py-1 rounded-lg shadow-sm">Tanggal: {cfDate}</span>}
          <button 
            onClick={() => { setCfDriver(null); setCfType(null); setCfDate(null); }}
            className="ml-auto underline hover:text-emerald-900 dark:hover:text-emerald-300 whitespace-nowrap"
          >
            Clear Filters
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
           <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Analyzing Safety Data...</p>
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
            {/* ── SUMMARY STATS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard 
                label="Total Pelanggaran" 
                value={totalViolations} 
                prevValue={activePrevViolations.length}
                icon={AlertTriangle}
                iconColor="text-slate-600"
                iconBg="bg-slate-100 dark:bg-slate-800"
                onClick={() => { setCfDriver(null); setCfType(null); setCfDate(null); }}
              />
              <StatCard 
                label="Akselerasi" 
                value={countType('akselerasi')} 
                prevValue={countType('akselerasi', typePrevViolations)}
                icon={Activity}
                iconColor="text-blue-500"
                iconBg="bg-blue-50 dark:bg-blue-900/20"
                active={cfType === 'Akselerasi'}
                activeColor="border-blue-500"
                onClick={() => setCfType(cfType === 'Akselerasi' ? null : 'Akselerasi')}
              />
              <StatCard 
                label="Rem Mendadak" 
                value={countType('perlambatan')} 
                prevValue={countType('perlambatan', typePrevViolations)}
                icon={AlertCircle}
                iconColor="text-amber-500"
                iconBg="bg-amber-50 dark:bg-amber-900/20"
                active={cfType === 'Perlambatan'}
                activeColor="border-amber-500"
                onClick={() => setCfType(cfType === 'Perlambatan' ? null : 'Perlambatan')}
              />
              <StatCard 
                label="Overspeed" 
                value={countType('kecepatan')} 
                prevValue={countType('kecepatan', typePrevViolations)}
                icon={Activity}
                iconColor="text-red-500"
                iconBg="bg-red-50 dark:bg-red-900/20"
                active={cfType === 'Kecepatan'}
                activeColor="border-red-500"
                onClick={() => setCfType(cfType === 'Kecepatan' ? null : 'Kecepatan')}
              />
              <StatCard 
                label="Tikungan Tajam" 
                value={countType('tikungan')} 
                prevValue={countType('tikungan', typePrevViolations)}
                icon={Route}
                iconColor="text-purple-500"
                iconBg="bg-purple-50 dark:bg-purple-900/20"
                active={cfType === 'Tikungan'}
                activeColor="border-purple-500"
                onClick={() => setCfType(cfType === 'Tikungan' ? null : 'Tikungan')}
              />
            </div>

            {/* ── CHARTS SECTION ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Trend Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">
                  Pelanggaran per {chartIsMonthly ? 'Bulan' : 'Hari'}
                </h3>
                <div className="h-96 w-full focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none" style={{ outline: 'none' }}>
                  <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
                    <BarChart 
                      data={dateTrend} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      style={{ outline: 'none' }}
                      className="cursor-pointer focus:outline-none"
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                        tickFormatter={(val) => {
                          if (chartIsMonthly) return val; // already "Jun 26" etc
                          const d = new Date(val);
                          return isNaN(d.getTime()) ? val : d.getDate().toString();
                        }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                        allowDecimals={false}
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
                      <Bar 
                        dataKey="akselerasi" name="Akselerasi" stackId="a" radius={[0, 0, 0, 0]} activeBar={false}
                        onClick={(data: any) => setCfDate(cfDate === data.payload.date ? null : data.payload.date)} 
                      >
                        {dateTrend.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#3b82f6" opacity={cfDate && cfDate !== entry.date ? 0.3 : 1} />
                        ))}
                      </Bar>
                      <Bar 
                        dataKey="perlambatan" name="Perlambatan" stackId="a" radius={[0, 0, 0, 0]} activeBar={false}
                        onClick={(data: any) => setCfDate(cfDate === data.payload.date ? null : data.payload.date)} 
                      >
                        {dateTrend.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#f59e0b" opacity={cfDate && cfDate !== entry.date ? 0.3 : 1} />
                        ))}
                      </Bar>
                      <Bar 
                        dataKey="kecepatan" name="Kecepatan" stackId="a" radius={[0, 0, 0, 0]} activeBar={false}
                        onClick={(data: any) => setCfDate(cfDate === data.payload.date ? null : data.payload.date)} 
                      >
                        {dateTrend.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#ef4444" opacity={cfDate && cfDate !== entry.date ? 0.3 : 1} />
                        ))}
                      </Bar>
                      <Bar 
                        dataKey="tikungan" name="Tikungan" stackId="a" radius={[4, 4, 0, 0]} activeBar={false}
                        onClick={(data: any) => setCfDate(cfDate === data.payload.date ? null : data.payload.date)} 
                      >
                        {dateTrend.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#8b5cf6" opacity={cfDate && cfDate !== entry.date ? 0.3 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">Persentase Pelanggaran</h3>
                <div className="h-80 w-full focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none" style={{ outline: 'none' }}>
                  <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
                    <PieChart style={{ outline: 'none' }} className="focus:outline-none">
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={105}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        label={renderPieLabel}
                        labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        onClick={(data: any) => data.name && setCfType(cfType === data.name ? null : data.name)}
                        className="cursor-pointer outline-none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} opacity={cfType && cfType !== entry.name ? 0.3 : 1} className="hover:opacity-80 transition-opacity" />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const val = Number(payload[0].value);
                            const total = pieData.reduce((acc, curr) => acc + curr.value, 0);
                            const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                            return (
                              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
                                <div>
                                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{payload[0].name}</p>
                                  <p className="text-sm font-black text-slate-900 dark:text-white">{percentage}% <span className="text-[10px] text-slate-500 font-bold">({val} kasus)</span></p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full mt-4 flex flex-wrap justify-center gap-3">
                  {pieData.map((entry, idx) => (
                    <div key={idx} className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${cfType && cfType !== entry.name ? 'opacity-30' : 'opacity-100 hover:opacity-80'}`} onClick={() => setCfType(cfType === entry.name ? null : entry.name)}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── MAP & RANKING SECTION ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map View */}
              <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 lg:col-span-2 flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Peta Persebaran Pelanggaran</h3>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                      Showing <span className="text-emerald-600">{Math.min(activeViolations.length, 1000)}</span> 
                      {activeViolations.length > 1000 ? ` of ${activeViolations.length}` : ''} Violations
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 min-h-125 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative z-0">
                  <MapContainer 
                    center={[-2.5489, 118.0149]} 
                    zoom={5} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <MapUpdater violations={activeViolations} />
                    
                    <MarkerClusterGroup
                      chunkedLoading
                      maxClusterRadius={40}
                      showCoverageOnHover={false}
                    >
                      {activeViolations.slice(0, 1000).map((v, i) => {
                        if (!v.koordinat) return null;
                        const parts = v.koordinat.split(',');
                        if (parts.length !== 2) return null;
                        const lat = parseFloat(parts[0].trim());
                        const lng = parseFloat(parts[1].trim());
                        if (isNaN(lat) || isNaN(lng)) return null;

                        const iconKey = v.jenis_peringatan || 'default';
                        let selectedIcon = iconMap['default'];
                        if (iconKey.includes('Akselerasi')) selectedIcon = iconMap['Akselerasi Mendadak'];
                        else if (iconKey.includes('Perlambatan')) selectedIcon = iconMap['Perlambatan Mendadak'];
                        else if (iconKey.includes('Kecepatan')) selectedIcon = iconMap['Kecepatan Melebihi Batas'];
                        else if (iconKey.includes('Tikungan')) selectedIcon = iconMap['Tikungan Tajam'];

                        return (
                          <Marker 
                            key={`marker-${i}`} 
                            position={[lat, lng]}
                            icon={selectedIcon}
                            eventHandlers={{
                              click: (e) => {
                                const m = e.target._map;
                                if (m) {
                                  if (m.getZoom() < 16) {
                                    m.flyTo([lat, lng], 16, { duration: 1.2 });
                                  } else {
                                    m.panTo([lat, lng]);
                                  }
                                }
                              }
                            }}
                          >
                            <Popup className="custom-popup">
                              <div className="p-1 min-w-52">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase mb-2 ${
                                  iconKey.includes('Akselerasi') ? 'bg-blue-500 text-white' :
                                  iconKey.includes('Perlambatan') ? 'bg-amber-500 text-white' :
                                  iconKey.includes('Kecepatan') ? 'bg-red-500 text-white' :
                                  'bg-purple-500 text-white'
                                }`}>{v.jenis_peringatan}</span>
                                <p className="text-[10px] text-slate-500 font-bold line-clamp-2">{v.lokasi}</p>
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                  <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{v.pengemudi}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{v.tanggal}</span>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </MarkerClusterGroup>
                  </MapContainer>
                </div>
              </div>

              {/* Ranking Table & Detailed Log */}
              <div className="space-y-6">
                {/* Ranking Table */}
                <div className="bg-white dark:bg-slate-900 rounded-4xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-100">
                  <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-500" />
                      Driver Rankings
                    </h3>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px]">Rank</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px]">Driver</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rankings.slice((rankPage - 1) * rankPerPage, rankPage * rankPerPage).map((r, i) => {
                          const rankNum = (rankPage - 1) * rankPerPage + i + 1;
                          return (
                            <tr 
                              key={i} 
                              onClick={() => setCfDriver(cfDriver === r.driver ? null : r.driver)}
                              className={`transition-colors cursor-pointer ${cfDriver === r.driver ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                            >
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black ${
                                  rankNum === 1 ? 'bg-red-100 text-red-600' :
                                  rankNum === 2 ? 'bg-orange-100 text-orange-600' :
                                  rankNum === 3 ? 'bg-amber-100 text-amber-600' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                  {rankNum}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p 
                                  className={`font-black truncate max-w-30 cursor-pointer hover:underline ${cfDriver === r.driver ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedCoachingDriver(r.driver); }}
                                >
                                  {r.driver}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{r.plat}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-black text-slate-900 dark:text-white text-sm">{r.total}</span>
                                <span className="text-[9px] font-bold text-slate-400 ml-1">({((r.total / Math.max(1, driverViolations.length)) * 100).toFixed(1)}%)</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {rankings.length > rankPerPage && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center">
                      <div className="flex gap-1">
                        <button disabled={rankPage === 1} onClick={() => setRankPage(p => p - 1)} className="p-1 bg-white dark:bg-slate-700 rounded shadow-sm disabled:opacity-50"><ChevronLeft className="w-3.5 h-3.5" /></button>
                        <button disabled={rankPage >= Math.ceil(rankings.length / rankPerPage)} onClick={() => setRankPage(p => p + 1)} className="p-1 bg-white dark:bg-slate-700 rounded shadow-sm disabled:opacity-50"><ChevronRight className="w-3.5 h-3.5" /></button>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{rankPage}/{Math.ceil(rankings.length / rankPerPage)}</span>
                    </div>
                  )}
                </div>

                {/* Detailed Incident Log */}
                <div className="bg-white dark:bg-slate-900 rounded-4xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-100">
                  <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Violation Logs</h3>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Latest abnormalities</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[8px] font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {activeViolations.length} ITEMS
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
                    {activeViolations.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-40">
                        <Shield className="w-10 h-10 text-slate-300" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Safe operations, no incidents</p>
                      </div>
                    ) : (
                      activeViolations.slice(0, 50).map((v, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => {
                            setCfDriver(cfDriver === v.pengemudi ? null : v.pengemudi);
                            // Optional: Zoom map to this specific incident
                            if (v.koordinat) {
                              const [lat, lng] = v.koordinat.split(',').map((c: string) => parseFloat(c.trim()));
                              const mapEl = document.querySelector('.leaflet-container');
                              if (mapEl && (mapEl as any)._leaflet_map) {
                                (mapEl as any)._leaflet_map.flyTo([lat, lng], 16, { duration: 1.5 });
                              }
                            }
                          }}
                          className={`group relative p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                            cfDriver === v.pengemudi 
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-lg shadow-blue-500/10' 
                              : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 hover:border-blue-400/50 hover:shadow-md'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2.5">
                            <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${
                              v.jenis_peringatan?.includes('Akselerasi') ? 'bg-blue-500 text-white' :
                              v.jenis_peringatan?.includes('Perlambatan') ? 'bg-amber-500 text-white' :
                              v.jenis_peringatan?.includes('Kecepatan') ? 'bg-red-500 text-white' :
                              'bg-purple-500 text-white'
                            }`}>
                              {v.jenis_peringatan}
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Clock className="w-2.5 h-2.5" />
                              <span className="text-[8px] font-black tracking-tighter uppercase">{v.tanggal}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-[11px] font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors uppercase leading-none">
                              {v.pengemudi}
                            </p>
                            <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400">
                              <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-red-500/50" />
                              <p className="text-[9px] font-bold leading-relaxed line-clamp-2 italic">
                                {v.lokasi}
                              </p>
                            </div>
                          </div>
                          
                          {/* Decoration line */}
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-transparent group-hover:bg-blue-500 rounded-full transition-all duration-300" />
                        </motion.div>
                      ))
                    )}
                    {activeViolations.length > 50 && (
                      <div className="py-4 flex flex-col items-center gap-2">
                        <div className="h-px w-12 bg-slate-100 dark:bg-slate-800" />
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em]">Showing latest 50 logs</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* ── TOP 10 VIOLATORS ── */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 lg:col-span-2">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                  Top 10 Violators
                </h3>
              </div>
              <div className="h-120 w-full focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none" style={{ outline: 'none' }}>
                <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
                  <BarChart data={driverBarData} layout="vertical" margin={{ top: 10, right: 50, left: 20, bottom: 0 }} style={{ outline: 'none' }} className="focus:outline-none">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.3} />
                    <XAxis 
                      type="number"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                      width={80}
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">{payload[0].payload.fullName}</p>
                              <p className="text-lg font-black text-slate-900 dark:text-white">{payload[0].value} <span className="text-xs text-slate-500">Pelanggaran</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="total" 
                      radius={[0, 6, 6, 0]} 
                      activeBar={false}
                      onClick={(data: any) => setCfDriver(cfDriver === data.fullName ? null : data.fullName)}
                      className="cursor-pointer focus:outline-none"
                      style={{ outline: 'none' }}
                      label={({ x, y, width, height, value, index }) => {
                        const entry = driverBarData[index];
                        if (!entry) return null;
                        return (
                          <text x={Number(x) + Number(width) + 5} y={Number(y) + Number(height) / 2} fill="#94a3b8" textAnchor="start" dominantBaseline="central" fontSize={9} fontWeight={700}>
                            {value} ({entry.pct})
                          </text>
                        );
                      }}
                    >
                      {driverBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={cfDriver === entry.fullName ? '#1e40af' : cfDriver ? '#bfdbfe' : '#3b82f6'} className="hover:opacity-80 transition-opacity focus:outline-none" style={{ outline: 'none' }}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>


            {/* ── COACHING PHOTO COMPONENT ── */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-full">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    Dokumentasi Coaching
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {selectedCoachingDriver || "Pilih driver di ranking"}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 rounded-3xl p-4">
                {!selectedCoachingDriver ? (
                  <div className="flex flex-col items-center justify-center text-slate-400 opacity-50 py-12">
                    <Camera className="w-12 h-12 mb-3" />
                    <p className="text-xs font-bold uppercase tracking-widest text-center px-4">
                      Klik nama driver pada tabel Ranking untuk melihat foto
                    </p>
                  </div>
                ) : (
                  <div className="h-[400px] w-full rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative group flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700">
                    {isLoadingPhoto ? (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p className="text-xs font-medium">Memuat foto...</p>
                      </div>
                    ) : coachingPhotoUrl ? (
                      <>
                        <img 
                          src={coachingPhotoUrl} 
                          alt="Coaching Session"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-sm font-bold transition-all"
                          >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isUploading ? 'Uploading...' : 'Ganti Foto'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Camera className="w-10 h-10 mb-3 opacity-50" />
                        <p className="text-sm font-medium mb-4">Belum ada foto coaching</p>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-70"
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {isUploading ? 'Uploading...' : 'Upload Foto'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                />
              </div>
            </div>
          </div>

          </motion.div>
        </AnimatePresence>
      )}


    </div>
  );
}






