import { useState, useEffect, useMemo, useRef } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, MapPin, ChevronRight, ChevronDown, ChevronUp, Search, Filter, Clock, TrendingUp, AlertCircle,
  Truck, CheckCircle2, Package, ArrowUpRight, ArrowDownRight, Info, Timer, LayoutDashboard, X, ArrowRight,
  ChevronLeft, Circle, Navigation, Map as MapIcon, Flag, CalendarDays, BarChart3, ListFilter, AlertTriangle, Home
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { leadtimeService, LeadTimeData } from '../services/leadtimeService';

const STATUS_COLORS = {
  ontime: '#10b981', // Emerald/Green
  advance: '#f59e0b', // Amber/Yellow
  delay: '#ef4444',   // Red
  pending: '#3b82f6', // Blue/Sky for Belum Sampai
  navy: '#1e3a8a',
  slate: '#94a3b8'
};

// Standard Leadtime (jam) per tujuan di area SUMATERA
const SUMATERA_THRESHOLDS: Record<string, number> = {
  LAMPUNG: 24,
  PALEMBANG: 36,
  PEKANBARU: 72,
};

const parseDurationHours = (str?: string | null): number | null => {
  if (!str || String(str).trim().length < 2) return null;
  const text = String(str).trim();
  const isNegative = text.startsWith('-');
  const dayMatch = text.match(/(\d+)\s*hari/);
  const hourMatch = text.match(/(\d+)\s*jam/);
  let total = 0;
  if (dayMatch) total += parseInt(dayMatch[1]) * 24;
  if (hourMatch) total += parseInt(hourMatch[1]);
  return isNegative ? -total : total;
};

const ITEMS_PER_PAGE = 15;

const TIMELINE_FLOWS: Record<string, string[]> = {
  'JBK': ['OutPool', 'InPDC', 'OutPDC', 'Unloading'],
  'TMMIN': ['OutPool', 'InPDC', 'OutPDC', 'Unloading'],
  'NGORO': [
    'OutPool', 'InPDC', 'OutPDC', 
    'KM 166', 'KM 379A', 'KM 575A', 
    'Unloading', 
    'KM 575B', 'KM 360B', 'KM 164B', 
    'InPool'
  ],
  'SUMATERA': [
    'OutPool', 'InPDC', 'OutPDC', 
    'Pelabuhan Merak', 'Pelabuhan Bakauheni', 
    'Unloading', 'InPool'
  ],
  'DEFAULT': ['OutPool', 'InPDC', 'OutPDC', 'Unloading', 'InPool']
};

const KEY_MAP: Record<string, {actual: string[], plan: string[], stage: string}> = {
  'OutPool': { actual: ['Actual (LeadTime)', 'keluar pool', 'outpool', 'abnormalty', 'Actual Exit Pool'], plan: ['plan outpool', 'rencana keluar', 'Estimasi (Lead Time)', 'Estimasi'], stage: 'outpool' },
  'InPDC': { actual: ['Actual (LeadTime)', 'IN PDC', 'inpdc', 'in pdc'], plan: ['plan inpdc', 'PLAN', 'Plan DCCP'], stage: 'inpdc' },
  'OutPDC': { actual: ['Out PDC', 'out pdc', 'outpdc'], plan: ['plan outpdc'], stage: 'outpdc' },
  'Unloading': { actual: ['Actual (Unloading)', 'Unloading PDC POLYGON', 'aktual unloading', 'aktual bongkar'], plan: ['plan bongkar'], stage: 'delivery' },
  'KM 166': { actual: ['KM 166'], plan: [], stage: 'unknown' },
  'KM 379A': { actual: ['KM 379A'], plan: [], stage: 'unknown' },
  'KM 575A': { actual: ['KM 575A'], plan: [], stage: 'unknown' },
  'KM 575B': { actual: ['KM 575B'], plan: [], stage: 'unknown' },
  'KM 360B': { actual: ['KM 360B'], plan: [], stage: 'unknown' },
  'KM 164B': { actual: ['KM 164B'], plan: [], stage: 'unknown' },
  'Pelabuhan Merak': { actual: ['Pelabuhan Merak', 'pelabuhan merak', 'merak'], plan: [], stage: 'unknown' },
  'Pelabuhan Bakauheni': { actual: ['Pelabuhan Bakauheni', 'pelabuhan bakauheni', 'bakauheni'], plan: [], stage: 'unknown' },
  'InPool': { actual: ['Actual (BackToPool)', 'BACK TO POOL', 'inpool', 'in pool'], plan: ['Plan (BackToPool)', 'plan backtopool'], stage: 'backtopool' }
};

export default function LeadTimePage({ isTAM = false }: { isTAM?: boolean }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]);
  const [area, setArea] = useState('ALL');
  const [filterMode, setFilterMode] = useState<'month'|'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<LeadTimeData[]>([]);
  const [prevData, setPrevData] = useState<LeadTimeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [activeFilter, setActiveFilter] = useState<{stage: string, status: string} | null>(null);
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<{title: string, reason: string, count: number} | null>(null);
  const [delayPopup, setDelayPopup] = useState<{title: string, reasons: {name:string,value:number}[], delayCount: number} | null>(null);
  const [trendStage, setTrendStage] = useState<'outpool' | 'inpdc' | 'delivery' | 'backtopool'>('delivery');
  const [globalDriverFilter, setGlobalDriverFilter] = useState<string | null>(null);
  const [tableStageFilter, setTableStageFilter] = useState<'ALL' | 'outpool' | 'inpdc' | 'delivery' | 'backtopool'>('ALL');
  const [sortBy, setSortBy] = useState<string>('tanggal');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const TAM_AREAS = ['ALL', 'JBK', 'NGORO', 'SUMATERA', 'PADANG', 'KALIMANTAN', 'SULAWESI'];
  const areas = isTAM
    ? ['ALL', 'JBK', 'NGORO', 'TMMIN', 'SUMATERA', 'PADANG', 'SULAWESI', 'KALIMANTAN'].filter(a => TAM_AREAS.includes(a))
    : ['ALL', 'JBK', 'NGORO', 'TMMIN', 'SUMATERA', 'PADANG', 'SULAWESI', 'KALIMANTAN'];

  useEscapeKey(() => {
    if (selectedReason) setSelectedReason(null);
    if (delayPopup) setDelayPopup(null);
  }, !!selectedReason || !!delayPopup);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, area, filterMode, selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const formatLocal = (d: Date) => {
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      };

      let currentStart, currentEnd;
      if (filterMode === 'month') {
        const [y, m] = selectedMonth.split('-');
        currentStart = new Date(parseInt(y), parseInt(m) - 1, 1);
        currentEnd = new Date(parseInt(y), parseInt(m), 0);
      } else {
        currentStart = new Date(startDate);
        currentEnd = new Date(endDate);
      }

      // 1. Current Period
      let result = await leadtimeService.getLeadTimes(
        formatLocal(currentStart),
        formatLocal(currentEnd),
        area
      );
      
      if (isTAM) {
        result = result.filter(item => {
          const areaStr = (item.area || '').toUpperCase();
          const proj = ((item as any).customer || (item as any).Customer || (item as any).project || '').toUpperCase();
          return !areaStr.includes('SULAWESI') && !proj.includes('TMMIN');
        });
      }
      
      setData(result);

      // 2. Previous Period
      let prevStart, prevEnd;
      if (filterMode === 'month') {
        const [y, m] = selectedMonth.split('-');
        prevStart = new Date(parseInt(y), parseInt(m) - 2, 1);
        prevEnd = new Date(parseInt(y), parseInt(m) - 1, 0);
      } else {
        const diff = currentEnd.getTime() - currentStart.getTime();
        prevEnd = new Date(currentStart.getTime() - 86400000);
        prevStart = new Date(prevEnd.getTime() - diff);
      }
      
      let prevResult = await leadtimeService.getLeadTimes(
        formatLocal(prevStart),
        formatLocal(prevEnd),
        area
      );
      
      if (isTAM) {
        prevResult = prevResult.filter(item => {
          const areaStr = (item.area || '').toUpperCase();
          const proj = ((item as any).customer || (item as any).Customer || (item as any).project || '').toUpperCase();
          return !areaStr.includes('SULAWESI') && !proj.includes('TMMIN');
        });
      }
      
      setPrevData(prevResult);
    } catch (error) {
      console.error('Failed to fetch leadtime data:', error);
    }
    setIsLoading(false);
  };

  const getTripCounts = (trip: LeadTimeData, filter: string, areaName: string) => {
    let counts = { onTime: 0, advance: 0, delay: 0, pending: 0 };
    const stages = filter === 'ALL' ? ['outpool', 'inpdc', 'delivery', 'backtopool'] : [filter];
    stages.forEach(s => {
      const stat = getRowStatus(trip, s);
      if (stat === 'OnTime') counts.onTime++;
      else if (stat === 'Advance') counts.advance++;
      else if (stat === 'Delay') counts.delay++;
      else if (stat === 'Belum Sampai') counts.pending++;
    });
    return counts;
  };

  const getRowStatus = (item: LeadTimeData, stage: string) => {
    const areaName = item.area?.toUpperCase() || '';
    const info = item.status_info || {};
    const points = item.checkpoints || {};

    const findExactOrInclude = (obj: any, keys: string[]) => {
      for (const k of keys) {
        if (obj[k]) return obj[k].toString();
        for (const key in obj) {
          if (key.toLowerCase().includes(k.toLowerCase())) return obj[key].toString();
        }
      }
      return '';
    };

    if (stage === 'outpool') {
      const val = findExactOrInclude(info, ['Evaluasi Keluar Pool', 'Abnormalty', 'Actual OutPool']).toLowerCase();
      if (val.includes('delay')) return 'Delay';
      return 'OnTime';
    }

    if (stage === 'inpdc') {
      const val = findExactOrInclude(info, ['Evaluasi Kedatangan CC', 'Actual InPDC', 'Actual In PDC']).toLowerCase();
      if (val.includes('advance')) return 'Advance';
      if (val.includes('delay')) return 'Delay';
      if (val.includes('ontime') || val.includes('on time') || val.includes('ok')) return 'OnTime';
      const fall = findExactOrInclude(info, ['Keterangan']).toLowerCase();
      if (fall.includes('advance')) return 'Advance';
      if (fall.includes('delay')) return 'Delay';
      if (fall.includes('ontime') || fall.includes('on time') || fall.includes('ok')) return 'OnTime';
      return 'Unknown';
    }

    if (stage === 'delivery') {
      let val = '';
      if (areaName === 'JBK') val = (findExactOrInclude(points, ['LeadTime Delivery']) || findExactOrInclude(info, ['Leadtime delivery'])).toLowerCase();
      else if (areaName === 'NGORO') val = findExactOrInclude(info, ['Status Leadtime Delivery']).toLowerCase();
      else if (areaName === 'TMMIN') val = (findExactOrInclude(points, ['LeadTime Delivery', 'Leadtime delivery']) || findExactOrInclude(info, ['Status Leadtime'])).toLowerCase();
      else if (['PADANG', 'SULAWESI', 'KALIMANTAN'].includes(areaName)) val = findExactOrInclude(info, ['Status Leadtime', 'Actual Delivery']).toLowerCase();
      else if (areaName === 'SUMATERA') {
        const durationStr = findExactOrInclude(points, ['LeadTime Delivery']);
        const destination = findExactOrInclude(info, ['Tujuan', 'Tujuan CC', 'Destination']).toUpperCase();

        // Standard Leadtime Sumatera:
        // Lampung: <= 24 jam (OnTime), > 24 jam (Delay)
        // Palembang: <= 36 jam (OnTime), > 36 jam (Delay)
        // Pekanbaru: <= 72 jam (OnTime), > 72 jam (Delay)
        const thresholdKey = ['LAMPUNG', 'PALEMBANG', 'PEKANBARU'].find(d => destination.includes(d)) || '';
        const threshold = SUMATERA_THRESHOLDS[thresholdKey] ?? 72;

        // Sudah sampai = ada waktu UNLOADING PDC
        const unloading = (findExactOrInclude(points, ['UNLOADING PDC']) || '').toString().trim();
        const arrived = unloading !== '' && unloading !== '-';

        const totalHours = parseDurationHours(durationStr);

        if (!arrived) {
          // Masih di perjalanan: hitung elapsed hours dari waktu keluar pool (Actual outpool) sampai SEKARANG
          const departureTime = findExactOrInclude(points, ['keluar pool', 'outpool', 'Actual Exit Pool', 'Actual']);
          if (departureTime && item.tanggal) {
            const cleanTime = departureTime.trim().length === 5 ? `${departureTime.trim()}:00` : departureTime.trim();
            const depDate = new Date(`${item.tanggal}T${cleanTime}`);
            if (!isNaN(depDate.getTime())) {
              const elapsedHours = (Date.now() - depDate.getTime()) / (1000 * 60 * 60);
              return elapsedHours >= threshold ? 'Delay' : 'Belum Sampai';
            }
          }
          return 'Belum Sampai';
        }

        // Sudah sampai
        if (totalHours === null) return 'Unknown';
        return totalHours > threshold ? 'Delay' : 'OnTime';
      }
      if (val.includes('delay')) return 'Delay';
      if (val.includes('ontime') || val.includes('on time') || val.includes('ok')) return 'OnTime';
      return 'Unknown';
    }
    if (stage === 'backtopool') {
      const val = findExactOrInclude(info, ['Status Leadtime Back To Pool', 'Actual BackToPool', 'Actual Back To Pool', 'Evaluasi Kembali Pool', 'Back To Pool']).toLowerCase();
      if (val.includes('delay')) return 'Delay';
      if (val.includes('ontime') || val.includes('on time') || val.includes('ok')) return 'OnTime';
      return 'Unknown';
    }
    return 'Unknown';
  };

  const baseData = useMemo(() => {
    if (!globalDriverFilter) return data;
    return data.filter(d => d.driver === globalDriverFilter);
  }, [data, globalDriverFilter]);

  const stats = useMemo(() => {
    if (baseData.length === 0) return null;
    const totalRecords = baseData.length;

    const getStageStats = (stage: string, reasonKeywords: string[]) => {
      const counts: Record<string, number> = { 'OnTime': 0, 'Delay': 0, 'Advance': 0, 'Belum Sampai': 0 };
      let unknown = 0;
      const reasons: Record<string, number> = {};

      baseData.forEach(item => {
        const status = getRowStatus(item, stage);
        if (counts[status] !== undefined) counts[status]++;
        else unknown++;
        for (const key in item.status_info) {
          if (reasonKeywords.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
            const val = item.status_info[key];
            if (val && !val.toLowerCase().includes('ontime') && !val.toLowerCase().includes('ok') && val !== '-' && !val.toLowerCase().includes('tidak ada')) {
              reasons[val] = (reasons[val] || 0) + 1;
            }
          }
        }
      });

      // total = hanya yang punya data (exclude Unknown)
      const total = counts.OnTime + counts.Delay + counts.Advance + counts['Belum Sampai'];
      const chartData = Object.entries(counts).map(([name, value]) => ({ 
        name, value, percentage: total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%'
      }));

      // coverage = berapa % dari total records yang punya data di stage ini
      const coverage = totalRecords > 0 ? Math.round((total / totalRecords) * 100) : 0;

      return {
        chartData, total, unknown, coverage, totalRecords,
        reasons: Object.entries(reasons).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8)
      };
    };

    const getTrend = (stage: string) => {
      const dailyData: Record<string, any> = {};
      baseData.forEach(item => {
        const date = new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        if (!dailyData[date]) dailyData[date] = { date, OnTime: 0, Delay: 0, Advance: 0, 'Belum Sampai': 0, Total: 0 };
        const status = getRowStatus(item, stage);
        if (dailyData[date][status] !== undefined) dailyData[date][status]++;
        dailyData[date].Total++;
      });
      return Object.values(dailyData).map(d => ({
        ...d,
        onTimeRate: d.Total > 0 ? Math.round(((d.OnTime + d.Advance) / d.Total) * 100) : 0
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    return {
      outpool: getStageStats('outpool', ['Evaluasi Keluar Pool', 'Abnormalty', 'Reason Delay OutPool', 'Reason Delay Out Pool']),
      inpdc: getStageStats('inpdc', ['Evaluasi Kedatangan CC', 'delay inpdc', 'Reason Delay InPDC', 'Reason Delay In PDC', 'Reason Delay PDC']),
      delivery: getStageStats('delivery', ['Reason Delay Delivery']),
      backtopool: getStageStats('backtopool', ['Reason Delay BackToPool', 'Reason Delay Back To Pool', 'Reason Delay BackToPool']),
      trend: getTrend(trendStage),
      totalRecords
    };
  }, [baseData, trendStage]);

  const prevStats = useMemo(() => {
    if (prevData.length === 0) return null;
    const getStageStats = (stage: string) => {
      const counts: Record<string, number> = { 'OnTime': 0, 'Delay': 0, 'Advance': 0, 'Belum Sampai': 0 };
      prevData.forEach(item => {
        const status = getRowStatus(item, stage);
        if (counts[status] !== undefined) counts[status]++;
      });
      const total = counts.OnTime + counts.Delay + counts.Advance + counts['Belum Sampai'];
      const chartData = Object.entries(counts).map(([name, value]) => ({ 
        name, value, percentage: total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%'
      }));
      return { total, chartData };
    };
    return {
      outpool: getStageStats('outpool'),
      inpdc: getStageStats('inpdc'),
      delivery: getStageStats('delivery'),
      backtopool: getStageStats('backtopool')
    };
  }, [prevData]);

  const prevPeriodText = useMemo(() => {
    let prevStart, prevEnd;
    if (filterMode === 'month') {
      const [y, m] = selectedMonth.split('-');
      prevStart = new Date(parseInt(y), parseInt(m) - 2, 1);
      prevEnd = new Date(parseInt(y), parseInt(m) - 1, 0);
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diff = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 86400000);
      prevStart = new Date(prevEnd.getTime() - diff);
    }
    
    const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase();
    return `VS ${fmt(prevStart)} - ${fmt(prevEnd)} ${prevEnd.getFullYear()}`;
  }, [startDate, endDate, filterMode, selectedMonth]);

  const currentPeriodText = useMemo(() => {
    let currentStart, currentEnd;
    if (filterMode === 'month') {
      const [y, m] = selectedMonth.split('-');
      currentStart = new Date(parseInt(y), parseInt(m) - 1, 1);
      currentEnd = new Date(parseInt(y), parseInt(m), 0);
    } else {
      currentStart = new Date(startDate);
      currentEnd = new Date(endDate);
    }
    
    const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase();
    return `${fmt(currentStart)} - ${fmt(currentEnd)} ${currentEnd.getFullYear()}`;
  }, [startDate, endDate, filterMode, selectedMonth]);

  const filteredData = useMemo(() => {
    let result = baseData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.driver?.toLowerCase().includes(q) ||
        item.no_polisi?.toLowerCase().includes(q)
      );
    }
    if (reasonFilter) {
      const q = reasonFilter.toLowerCase();
      result = result.filter(item => {
        const info = item.status_info || {};
        const points = item.checkpoints || {};
        return Object.values(info).some(v => v?.toString().toLowerCase() === q) ||
               Object.values(points).some(v => v?.toString().toLowerCase() === q);
      });
    }
    if (activeFilter) {
      result = result.filter(item => getRowStatus(item, activeFilter.stage) === activeFilter.status);
    }
    // Auto-hide records with no data for the active stage filter
    if (tableStageFilter !== 'ALL') {
      result = result.filter(item => getRowStatus(item, tableStageFilter) !== 'Unknown');
    } else {
      // When ALL: hide records that have no data in ANY stage (completely empty)
      result = result.filter(item => {
        const stages = ['outpool', 'inpdc', 'delivery', 'backtopool'];
        return stages.some(s => getRowStatus(item, s) !== 'Unknown');
      });
    }
    return result;
  }, [baseData, searchQuery, activeFilter, reasonFilter, tableStageFilter]);

  const groupedData = useMemo(() => {
    const map: Record<string, {
      id: string,
      tanggal: string,
      area: string,
      driver: string,
      no_polisi: string,
      shift: string,
      onTime: number,
      advance: number,
      delay: number,
      trips: LeadTimeData[]
    }> = {};

    filteredData.forEach(item => {
      const key = item.driver || 'Unknown';
      if (!map[key]) {
        map[key] = {
          id: key,
          tanggal: item.tanggal,
          area: item.area,
          driver: item.driver || 'Unknown',
          no_polisi: item.no_polisi || '-',
          shift: item.shift || '-',
          onTime: 0,
          advance: 0,
          delay: 0,
          trips: []
        };
      }
      const counts = getTripCounts(item, tableStageFilter, area);
      map[key].onTime += counts.onTime;
      map[key].advance += counts.advance;
      map[key].delay += counts.delay;
      map[key].trips.push(item);
    });

    return Object.values(map).sort((a, b) => {
      let av: any, bv: any;
      if (sortBy === 'tanggal') { av = a.tanggal; bv = b.tanggal; }
      else if (sortBy === 'driver') { av = a.driver; bv = b.driver; }
      else if (sortBy === 'ontime') { av = a.onTime; bv = b.onTime; }
      else if (sortBy === 'advance') { av = a.advance; bv = b.advance; }
      else if (sortBy === 'delay') { av = a.delay; bv = b.delay; }
      else { av = a.tanggal; bv = b.tanggal; }
      
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortBy, sortDir, tableStageFilter, area]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
  const paginatedData = groupedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const calculateEfficiency = (stage: string) => {
    const s = (stats as any)?.[stage];
    if (!s) return "0%";
    const total = s.total;
    if (total === 0) return "0%";
    const onTime = s.chartData.find((d: any) => d.name === 'OnTime')?.value || 0;
    const advance = s.chartData.find((d: any) => d.name === 'Advance')?.value || 0;
    return (((onTime + advance) / total) * 100).toFixed(1) + "%";
  };

  const getStatusValue = (item: LeadTimeData, stage: string) => {
    const info = item.status_info || {};
    const points = item.checkpoints || {};
    if (stage === 'outpool') return info['Evaluasi Keluar Pool'] || info['Abnormalty'] || info['Actual OutPool'] || '-';
    if (stage === 'inpdc') return info['Evaluasi Kedatangan CC'] || info['Keterangan'] || info['Actual InPDC'] || '-';
    if (stage === 'delivery') {
      const areaName = item.area?.toUpperCase();
      if (areaName === 'JBK') return points['LeadTime Delivery'] || info['Leadtime delivery'] || '-';
      if (areaName === 'NGORO') return info['Status Leadtime Delivery'] || '-';
      if (areaName === 'TMMIN') return points['LeadTime Delivery'] || points['Leadtime Delivery'] || info['Status Leadtime'] || '-';
      if (['PADANG', 'SULAWESI', 'KALIMANTAN'].includes(areaName)) return info['Actual Delivery'] || info['Status Leadtime'] || '-';
      if (areaName === 'SUMATERA') {
        for (const key in points) {
          if (key.toLowerCase().includes('leadtime delivery')) return points[key]?.toString() || '-';
        }
        return '-';
      }
    }
    if (stage === 'backtopool') return info['Status Leadtime Back To Pool'] || info['Actual BackToPool'] || '-';
    return '-';
  };

  // Helper: ekstrak nilai Reason Delay dari status_info berdasarkan stage
  const getReasonDelay = (item: LeadTimeData, stage: string): string | null => {
    const info = item.status_info || {};
    const findVal = (keywords: string[]) => {
      for (const kw of keywords) {
        for (const key in info) {
          if (key.toLowerCase().includes(kw.toLowerCase())) {
            const val = info[key]?.toString()?.trim();
            if (val && val !== '-' && val !== '') return val;
          }
        }
      }
      return null;
    };
    if (stage === 'outpool')   return findVal(['Reason Delay OutPool', 'Reason Delay Out Pool']);
    if (stage === 'inpdc')     return findVal(['Reason Delay InPDC', 'Reason Delay In PDC', 'Reason Delay PDC']);
    if (stage === 'delivery')  return findVal(['Reason Delay Delivery']);
    if (stage === 'backtopool') return findVal(['Reason Delay BackToPool', 'Reason Delay Back To Pool']);
    return null;
  };

  const getTimelineEvents = (item: LeadTimeData) => {
    const areaKey = item.area?.toUpperCase() || 'DEFAULT';
    const flowSteps = TIMELINE_FLOWS[areaKey] || TIMELINE_FLOWS['DEFAULT'];
    const points = item.checkpoints || {};
    const statusInfo = item.status_info || {};
    return flowSteps.map(step => {
      const config = KEY_MAP[step] || { actual: [step.toLowerCase()], plan: [], stage: 'unknown' };
      let actual = '', plan = '';
      for (const key in points) { if (config.actual.some(k => key.toLowerCase().includes(k.toLowerCase()))) { actual = points[key]?.toString() || ''; break; } }
      if (!actual) { for (const key in statusInfo) { if (config.actual.some(k => key.toLowerCase().includes(k.toLowerCase()))) { const val = statusInfo[key]?.toString() || ''; const match = val.match(/\d{2}:\d{2}/); if (match) actual = match[0]; break; } } }
      for (const key in points) { if (config.plan.some(k => key.toLowerCase().includes(k.toLowerCase()))) { plan = points[key]?.toString() || ''; break; } }
      if (!plan) { for (const key in statusInfo) { if (config.plan.some(k => key.toLowerCase().includes(k.toLowerCase()))) { const val = statusInfo[key]?.toString() || ''; const match = val.match(/\d{2}:\d{2}/); if (match) plan = match[0]; break; } } }
      const status = config.stage !== 'unknown' ? getRowStatus(item, config.stage) : 'OnTime';
const reasonDelay = config.stage !== 'unknown' ? (getReasonDelay(item, config.stage) || '') : '';
      return { label: step, actual, plan, status, reasonDelay };
    });
  }


  return (
    <div className="flex flex-col gap-4 sm:gap-10 pb-20 w-full max-w-[100vw] overflow-x-hidden px-1 sm:px-4 lg:px-6 box-border">
      {/* ── HEADER SECTION ── */}
      <div className="isolate bg-white dark:bg-slate-900 p-4 md:p-8 rounded-3xl md:rounded-4xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm w-full box-border">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 w-full lg:w-auto">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
              <Truck className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight truncate">LeadTime Center</h1>
              <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 mt-0.5 md:mt-1 uppercase tracking-widest truncate">
                <Timer className="w-3.5 h-3.5" /> Operational Analytics
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Filter Toggle Mode */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 border border-slate-200/50 dark:border-slate-700/50">
              <button 
                onClick={() => setFilterMode('month')} 
                className={`flex-1 sm:w-24 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filterMode === 'month' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Bulan
              </button>
              <button 
                onClick={() => setFilterMode('range')} 
                className={`flex-1 sm:w-24 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filterMode === 'range' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Tanggal
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:flex sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Date / Month Input */}
              {filterMode === 'month' ? (
                <div className="flex items-center px-3 py-2 gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-44">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }} 
                    className="bg-transparent border-none text-[11px] font-black tracking-wide focus:ring-0 text-slate-800 dark:text-slate-100 appearance-none cursor-pointer uppercase w-full p-0"
                  />
                </div>
              ) : (
                <div className="flex items-center px-3 py-2 gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto justify-center">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-800 dark:text-slate-100 p-0 w-[95px] cursor-pointer" />
                  <span className="text-slate-300 font-bold">—</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-800 dark:text-slate-100 p-0 w-[95px] cursor-pointer" />
                </div>
              )}
              
              {/* Area Dropdown */}
              <div className="w-full sm:w-auto">
                <AreaDropdown areas={areas} selected={area} onChange={(val) => { setArea(val); setCurrentPage(1); }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-10">
          {[1,2,3].map(i => <div key={i} className="h-75 sm:h-100 bg-slate-100 dark:bg-slate-800/50 rounded-3xl sm:rounded-4xl animate-pulse" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-12 w-full max-w-full overflow-hidden box-border">

          {/* ── RESET FILTER BAR ── */}
          {(activeFilter || reasonFilter || globalDriverFilter) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/30">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">
                  {globalDriverFilter ? `Driver: ${globalDriverFilter}` : activeFilter ? `Filter aktif: ${activeFilter.status} — ${activeFilter.stage.toUpperCase()}` : `Reason filter: ${reasonFilter}`}
                </p>
              </div>
              <button
                onClick={() => { setActiveFilter(null); setReasonFilter(null); setGlobalDriverFilter(null); setCurrentPage(1); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shrink-0 hover:bg-blue-700 transition-all"
              >
                <X className="w-3 h-3" /> Reset Filter
              </button>
            </div>
          )}

          {/* ── STAGE BOXES ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full overflow-hidden box-border">
            <StageBox
              title="OUTPOOL" icon={<Truck />} stats={stats?.outpool} prevStats={prevStats?.outpool}
              eff={calculateEfficiency('outpool')} stage="outpool" activeFilter={activeFilter} setActiveFilter={(f: any) => { setActiveFilter(f); setCurrentPage(1); }}
              prevPeriod={currentPeriodText}
            />
            <StageBox
              title="IN-PDC" icon={<Package />} stats={stats?.inpdc} prevStats={prevStats?.inpdc}
              eff={calculateEfficiency('inpdc')} stage="inpdc" activeFilter={activeFilter} setActiveFilter={(f: any) => { setActiveFilter(f); setCurrentPage(1); }}
              prevPeriod={currentPeriodText}
            />
            <StageBox
              title="DELIVERY" icon={<CheckCircle2 />} stats={stats?.delivery} prevStats={prevStats?.delivery}
              eff={calculateEfficiency('delivery')} stage="delivery" activeFilter={activeFilter} setActiveFilter={(f: any) => { setActiveFilter(f); setCurrentPage(1); }}
              prevPeriod={currentPeriodText}
            />
            <StageBox
              title="BACK TO POOL" icon={<Home />} stats={stats?.backtopool} prevStats={prevStats?.backtopool}
              eff={calculateEfficiency('backtopool')} stage="backtopool" activeFilter={activeFilter} setActiveFilter={(f: any) => { setActiveFilter(f); setCurrentPage(1); }}
              prevPeriod={currentPeriodText}
            />
          </div>

          {/* ── DELAY ANALYSIS CENTER ── */}
          <div className="bg-slate-900 rounded-[20px] sm:rounded-[40px] p-4 sm:p-10 shadow-2xl shadow-blue-500/10 border border-slate-800 w-full max-w-full overflow-hidden box-border">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 sm:mb-10 gap-6 overflow-hidden">
              <div className="min-w-0 overflow-hidden">
                <h3 className="text-base sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2 sm:gap-3 truncate">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" /> Delay Analysis
                </h3>
                <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">Klik DELAY untuk lihat rincian penyebab</p>
              </div>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-12 w-full max-w-full overflow-hidden`}>
              <ReasonSection title="OUTPOOL DELAYS" stageStats={stats?.outpool} color="text-amber-500"
                onClickDelay={() => setDelayPopup({ title: 'OUTPOOL DELAY REASONS', reasons: (stats?.outpool?.reasons || []).filter((r:any) => { const l=r.name.toLowerCase(); return !l.includes('delay')&&!l.includes('advance')&&!l.includes('ontime')&&l!=='ok'&&l!=='-'&&l!=='tidak ada'; }), delayCount: stats?.outpool?.chartData?.find((d:any)=>d.name==='Delay')?.value||0 })}
                onSelect={(r: any) => { setReasonFilter(r.name); setCurrentPage(1); }}
              />
              <ReasonSection title="IN-PDC ANALYSIS" stageStats={stats?.inpdc} color="text-blue-500"
                onClickDelay={() => setDelayPopup({ title: 'IN-PDC DELAY REASONS', reasons: (stats?.inpdc?.reasons || []).filter((r:any) => { const l=r.name.toLowerCase(); return !l.includes('delay')&&!l.includes('advance')&&!l.includes('ontime')&&l!=='ok'&&l!=='-'&&l!=='tidak ada'; }), delayCount: stats?.inpdc?.chartData?.find((d:any)=>d.name==='Delay')?.value||0 })}
                onSelect={(r: any) => { setReasonFilter(r.name); setCurrentPage(1); }}
              />
              <ReasonSection title="DELIVERY DELAYS" stageStats={stats?.delivery} color="text-rose-500"
                onClickDelay={() => setDelayPopup({ title: 'DELIVERY DELAY REASONS', reasons: (stats?.delivery?.reasons || []).filter((r:any) => { const l=r.name.toLowerCase(); return !l.includes('delay')&&!l.includes('advance')&&!l.includes('ontime')&&l!=='ok'&&l!=='-'&&l!=='tidak ada'; }), delayCount: stats?.delivery?.chartData?.find((d:any)=>d.name==='Delay')?.value||0 })}
                onSelect={(r: any) => { setReasonFilter(r.name); setCurrentPage(1); }}
              />
              <ReasonSection title="BACK TO POOL DELAYS" stageStats={stats?.backtopool} color="text-purple-400"
                onClickDelay={() => setDelayPopup({ title: 'BACK TO POOL DELAY REASONS', reasons: (stats?.backtopool?.reasons || []).filter((r:any) => { const l=r.name.toLowerCase(); return !l.includes('delay')&&!l.includes('advance')&&!l.includes('ontime')&&l!=='ok'&&l!=='-'&&l!=='tidak ada'; }), delayCount: stats?.backtopool?.chartData?.find((d:any)=>d.name==='Delay')?.value||0 })}
                onSelect={(r: any) => { setReasonFilter(r.name); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* ── PERFORMANCE TREND ── */}
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-[20px] sm:rounded-[40px] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl shadow-blue-500/5 p-4 sm:p-8 w-full max-w-full overflow-hidden box-border">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 sm:gap-6 overflow-hidden">
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 flex-1 overflow-hidden">
                <div>
                  <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight truncate">Performance Trend</h3>
                  <p className="text-[7px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">Daily Efficiency (OnTime + Advance)</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 w-fit">
                  {(['outpool', 'inpdc', 'delivery', 'backtopool'] as const)
                    .map((s) => (
                    <button
                      key={s}
                      onClick={() => setTrendStage(s)}
                      className={`py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        trendStage === s 
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {s.replace('backtopool', 'back-to-pool')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                <LegendItem color={STATUS_COLORS.ontime} label="OnTime" />
                <LegendItem color={STATUS_COLORS.advance} label="Advance" />
                <LegendItem color={STATUS_COLORS.delay} label="Delay" />
                <LegendItem color={STATUS_COLORS.advance} label="Rate (%)" isLine />
              </div>
            </div>
            <div className="h-50 sm:h-100 w-full min-w-0 overflow-hidden relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={stats?.trend} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.1} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#f59e0b' }} />
                  <Tooltip content={<CustomTrendTooltip />} />
                  <Bar yAxisId="left" dataKey="OnTime" stackId="a" fill={STATUS_COLORS.ontime} barSize={16} animationDuration={1200} animationEasing="ease-out" />
                  <Bar yAxisId="left" dataKey="Advance" stackId="a" fill={STATUS_COLORS.advance} barSize={16} animationDuration={1200} animationEasing="ease-out" />
                  <Bar yAxisId="left" dataKey="Delay" stackId="a" fill={STATUS_COLORS.delay} radius={[2, 2, 0, 0]} barSize={16} animationDuration={1200} animationEasing="ease-out" />
                  <Line yAxisId="right" type="monotone" dataKey="onTimeRate" stroke={STATUS_COLORS.advance} strokeWidth={2} dot={{ fill: STATUS_COLORS.advance, r: 2.5 }} animationDuration={1200} animationEasing="ease-out" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── DATA DETAILS ── */}
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-[20px] sm:rounded-[40px] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl shadow-blue-500/5 w-full max-w-full overflow-hidden box-border">
            <div className="p-4 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">LeadTime Details</h3>
                <p className="text-[8px] sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase tracking-wider truncate">
                  Showing <span className="font-black text-blue-600">{filteredData.length}</span> records
                </p>
              </div>
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 shrink-0">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 w-full lg:w-fit overflow-x-auto scrollbar-hide">
                  {(['ALL', 'outpool', 'inpdc', 'delivery', 'backtopool'] as const)
                    .map((s) => (
                    <button
                      key={s}
                      onClick={() => setTableStageFilter(s)}
                      className={`py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        tableStageFilter === s 
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {s.replace('backtopool', 'back-to-pool')}
                    </button>
                  ))}
                </div>
                <div className="relative w-full lg:w-62.5 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder="Quick search..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl text-[9px] font-bold focus:ring-2 focus:ring-blue-500 shadow-inner uppercase" />
                </div>
              </div>
            </div>

            {/* (Driver Delay Summary removed) */}

            <div className="w-full overflow-x-auto scrollbar-hide max-w-full block">
              <table className="w-full text-left min-w-150 border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-slate-400 uppercase text-[7px] sm:text-[9px] font-black tracking-widest border-b border-slate-100 dark:border-slate-800">
                    {[{key:'tanggal',label:'Periode/Area',w:'w-25'},{key:'driver',label:'Driver',w:'w-30'},{key:'',label:'Vehicle',w:'w-25'},{key:'ontime',label:'Total OnTime',w:'w-20'},{key:'advance',label:'Total Advance',w:'w-20'},{key:'delay',label:'Total Delay',w:'w-20'}].map(col => (
                      <th key={col.key||col.label} className={`px-4 py-5 ${col.w} cursor-pointer select-none`} onClick={() => col.key && handleSort(col.key)}>
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.key && sortBy === col.key && (
                            <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedData.map((item) => {
                    const counts = item;
                    const isSelected = globalDriverFilter === item.driver;
                    return (
                      <tr key={item.id} onClick={() => setGlobalDriverFilter(prev => prev === item.driver ? null : item.driver)} className={`hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-all group cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <td className="px-4 py-4 overflow-hidden">
                          <div className="text-[9px] sm:text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">
                            {item.trips.length > 1 ? (() => {
                              const dates = item.trips.map((t: any) => new Date(t.tanggal).getTime());
                              const min = new Date(Math.min(...dates));
                              const max = new Date(Math.max(...dates));
                              if (min.getTime() === max.getTime()) return min.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                              return `${min.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - ${max.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`;
                            })() : new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </div>
                          <div className="text-[7px] sm:text-[8px] text-blue-600 dark:text-blue-400 font-black mt-0.5 tracking-wider uppercase truncate">{item.area}</div>
                        </td>
                        <td className="px-4 py-4 overflow-hidden">
                          <div className="text-[9px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase truncate">{item.driver}</div>
                          <div className="text-[7px] sm:text-[8px] text-blue-500 font-black mt-0.5 uppercase tracking-widest truncate">{item.trips.length} TRIP{item.trips.length > 1 ? 'S' : ''}</div>
                        </td>
                        <td className="px-4 py-4 overflow-hidden">
                          <div className="text-[9px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase truncate">{item.no_polisi}</div>
                          <div className="text-[7px] sm:text-[8px] text-slate-400 font-bold uppercase tracking-tight mt-0.5 truncate">{item.shift || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-[10px] sm:text-[12px] font-black ${counts.onTime > 0 ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'}`}>{counts.onTime}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-[10px] sm:text-[12px] font-black ${counts.advance > 0 ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'}`}>{counts.advance}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-[10px] sm:text-[12px] font-black ${counts.delay > 0 ? 'text-rose-500' : 'text-slate-300 dark:text-slate-700'}`}>{counts.delay}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 flex flex-col xs:flex-row items-center justify-between gap-3 overflow-hidden">
              <p className="text-[7px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">
                Page {currentPage} of {totalPages || 1}
              </p>
              <div className="flex items-center gap-2">
                <button disabled={currentPage === 1} onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev - 1); }} className="p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button disabled={currentPage === totalPages || totalPages === 0} onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); }} className="p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 disabled:opacity-30 transition-all">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

      {/* ── MODALS ── */}
      {createPortal(
        <AnimatePresence>
          {delayPopup && (
            <div className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDelayPopup(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-[20px] sm:rounded-[40px] shadow-2xl p-5 sm:p-10 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                <ModalHeader title={delayPopup.title} onClose={() => setDelayPopup(null)} />
                <div className="space-y-4 mt-6">
                  {delayPopup.reasons.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {delayPopup.reasons.sort((a,b)=>b.value-a.value).map((r, i) => {
                        const pct = delayPopup.delayCount > 0 ? Math.round((r.value / delayPopup.delayCount) * 100) : 0;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setReasonFilter(r.name);
                              setCurrentPage(1);
                              setDelayPopup(null);
                            }}
                            className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200/50 dark:border-slate-700/50 text-left group"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-tight pr-4">{r.name}</span>
                              <div className="text-right shrink-0">
                                <span className="block text-sm font-black text-rose-500">{r.value}</span>
                                <span className="block text-[8px] font-bold text-slate-400">{pct}%</span>
                              </div>
                            </div>
                            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                     <div className="py-8 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                       Tidak ada detail delay spesifik
                     </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {selectedReason && (
            <div className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReason(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[20px] sm:rounded-[40px] shadow-2xl p-5 sm:p-10 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                <ModalHeader title={selectedReason.title} onClose={() => setSelectedReason(null)} />
                <div className="space-y-6 sm:space-y-8">
                  <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-3">Detailed Analysis</p>
                    <p className="text-xs sm:text-base font-bold text-slate-800 dark:text-slate-200 leading-relaxed uppercase tracking-tight">{selectedReason.reason}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Occurrences</p>
                      <p className="text-xl font-black text-rose-600 tracking-tighter truncate">{selectedReason.count} <span className="text-[9px] text-slate-400 ml-1 uppercase tracking-widest">Trips</span></p>
                    </div>
                    <button onClick={() => { setReasonFilter(selectedReason.reason); setSelectedReason(null); setCurrentPage(1); }} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl sm:rounded-2xl text-[10px] font-black shadow-lg shadow-blue-600/20 uppercase tracking-widest">View Trips</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
        </div>
      )}
    </div>
  );
}

function ReasonSection({ title, stageStats, color, onClickDelay, onSelect }: {
  title: string;
  stageStats: any;
  color: string;
  onClickDelay: () => void;
  onSelect: (r: { name: string; value: number }) => void;
}) {
  const allReasons: { name: string; value: number }[] = stageStats?.reasons || [];
  const delayCount: number = stageStats?.chartData?.find((d: any) => d.name === 'Delay')?.value || 0;
  const total: number = stageStats?.total || 0;
  const delayPct = total > 0 ? ((delayCount / total) * 100).toFixed(0) : '0';

  const actualReasons = allReasons.filter(r => {
    const lower = r.name.toLowerCase();
    return !lower.includes('delay') && !lower.includes('advance') && !lower.includes('ontime')
      && !lower.includes('on time') && lower !== 'ok' && lower !== '-' && lower !== 'tidak ada';
  });

  if (delayCount === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-1 h-4 rounded-full bg-current ${color}`} />
          <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{title}</h4>
        </div>
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/50 rounded-2xl bg-slate-800/20">
          <CheckCircle2 className="w-6 h-6 text-emerald-500/50 mb-2" />
          <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">No Abnormalities</span>
        </div>
      </div>
    );
  }

  const totalReasons = actualReasons.reduce((acc, r: any) => acc + r.value, 0);
  const CHART_COLORS = [
    '#d97757', // claude amber-500 (primary reason)
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#84cc16', // lime-500
    '#6366f1', // indigo-500
    '#f43f5e'  // rose-500
  ];

  const renderPieLabel = ({ percent, x, y, cx }: any) => {
    if (!percent || percent < 0.03) return null;
    try {
      return (
        <text
          x={Number(x)}
          y={Number(y)}
          fill="#94a3b8" // slate-400
          textAnchor={Number(x) > Number(cx) ? 'start' : 'end'}
          dominantBaseline="central"
          fontSize={8}
          fontWeight={900}
        >
          {(percent * 100).toFixed(1)}%
        </text>
      );
    } catch { return null; }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1 h-4 rounded-full bg-current ${color}`} />
        <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{title}</h4>
      </div>

      {/* DELAY reasons pie chart */}
      <div className="w-full p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full bg-current ${color}`} />
              <div className="text-xs font-black text-slate-300 uppercase tracking-widest">DELAY</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-white leading-none">{delayCount}</div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">{delayPct}% dari total</div>
            </div>
          </div>
          
          {actualReasons.length > 0 ? (
            <div className="flex flex-col mt-2">
              <div className="h-36 w-full relative -ml-2 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart style={{ outline: 'none' }} className="focus:outline-none">
                    <Pie
                      data={actualReasons}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                      label={renderPieLabel}
                      labelLine={{ stroke: '#475569', strokeWidth: 1 }}
                    >
                      {actualReasons.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pct = totalReasons > 0 ? ((payload[0].value as number) / totalReasons * 100).toFixed(1) : '0';
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-800 max-w-[200px]">
                              <p className="text-[10px] font-black text-white uppercase tracking-widest break-words">{payload[0].name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs font-black text-rose-400">{payload[0].value} Kasus</p>
                                <p className="text-[9px] font-bold text-slate-400">({pct}%)</p>
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
              
              {/* Legend Summary */}
              <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto max-h-32 pr-1 custom-scrollbar">
                {actualReasons.map((r: any, idx: number) => {
                  const pct = totalReasons > 0 ? ((r.value / totalReasons) * 100).toFixed(1) : '0';
                  return (
                    <div key={idx} className="flex justify-between items-center text-[9px] font-black tracking-widest uppercase">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span className="text-slate-400 truncate" title={r.name}>{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-slate-500 font-bold">{pct}%</span>
                        <span className="text-white min-w-[20px] text-right">{r.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center py-4">
              Tidak ada data rincian
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StageBox({ title, icon, stats, prevStats, eff, stage, activeFilter, setActiveFilter, prevPeriod }: any) {
  const onTimeData = stats?.chartData?.find((d: any) => d.name === 'OnTime');
  const delayData = stats?.chartData?.find((d: any) => d.name === 'Delay');
  const advanceData = stats?.chartData?.find((d: any) => d.name === 'Advance');
  const pendingData = stats?.chartData?.find((d: any) => d.name === 'Belum Sampai');
  const isInPdc = title === 'IN-PDC';
  const total = stats?.totalRecords || 0;
  
  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl sm:rounded-4xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl shadow-blue-500/5 p-3 sm:p-8 flex flex-col h-full hover:border-blue-500/30 transition-all duration-500 group overflow-hidden w-full max-w-full box-border">
      <div className="flex items-center gap-2.5 sm:gap-4 mb-4 sm:mb-8 overflow-hidden">
        <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl shrink-0 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h2 className="text-xs sm:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase truncate">{title}</h2>
      </div>
      
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6 sm:mb-10 w-full">
        <StatusCard 
          active={activeFilter?.stage === stage && activeFilter?.status === 'OnTime'}
          onClick={() => setActiveFilter({stage, status: 'OnTime'})}
          type="OnTime" 
          eff={onTimeData?.percentage || '0%'} 
          count={onTimeData?.value} 
          prevCount={prevStats?.chartData?.find((d: any) => d.name === 'OnTime')?.value}
          prevPeriod={prevPeriod}
        />
        <StatusCard 
          active={activeFilter?.stage === stage && activeFilter?.status === 'Advance'}
          onClick={() => setActiveFilter({stage, status: 'Advance'})}
          type="Advance" 
          eff={advanceData?.percentage || '0%'} 
          count={advanceData?.value} 
          prevCount={prevStats?.chartData?.find((d: any) => d.name === 'Advance')?.value}
          prevPeriod={prevPeriod}
        />
        <StatusCard 
          active={activeFilter?.stage === stage && activeFilter?.status === 'Delay'}
          onClick={() => setActiveFilter({stage, status: 'Delay'})}
          type="Delay" 
          eff={delayData?.percentage || '0%'} 
          count={delayData?.value} 
          prevCount={prevStats?.chartData?.find((d: any) => d.name === 'Delay')?.value}
          prevPeriod={prevPeriod}
        />
        <StatusCard 
          active={activeFilter?.stage === stage && activeFilter?.status === 'Belum Sampai'}
          onClick={() => setActiveFilter({stage, status: 'Belum Sampai'})}
          type="Belum Sampai" 
          eff={pendingData?.percentage || '0%'} 
          count={pendingData?.value} 
          prevCount={prevStats?.chartData?.find((d: any) => d.name === 'Belum Sampai')?.value}
          prevPeriod={prevPeriod}
        />
      </div>
      
      <div className="h-40 sm:h-64 relative flex items-center justify-center mt-auto overflow-hidden w-full max-w-full">
        <div className="w-full h-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={stats?.chartData} cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" paddingAngle={6} dataKey="value" animationDuration={1000} animationEasing="ease-out">
                <Cell fill={STATUS_COLORS.ontime} cursor="pointer" onClick={() => setActiveFilter({stage, status: 'OnTime'})} />
                <Cell fill={STATUS_COLORS.delay} cursor="pointer" onClick={() => setActiveFilter({stage, status: 'Delay'})} />
                <Cell fill={STATUS_COLORS.advance} cursor="pointer" onClick={() => setActiveFilter({stage, status: 'Advance'})} />
                <Cell fill={STATUS_COLORS.pending} cursor="pointer" onClick={() => setActiveFilter({stage, status: 'Belum Sampai'})} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{total}</span>
          <span className="text-[7px] sm:text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">TRIPS</span>
          <span className="text-[8px] sm:text-[10px] font-black text-blue-500 mt-1 uppercase tracking-widest">{eff}</span>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ onClick, active, type, eff, count, prevCount, prevPeriod }: any) {
  const isDelay = type === 'Delay';
  const isAdvance = type === 'Advance';
  const isPending = type === 'Belum Sampai';
  const delta = (count || 0) - (prevCount || 0);
  const isUp = delta > 0;
  const isGood = isDelay ? delta < 0 : (isPending ? delta < 0 : delta > 0);
  const isBad = isDelay ? delta > 0 : (isPending ? delta > 0 : delta < 0);
  const percentage = !prevCount ? (count > 0 ? 100 : 0) : Math.abs((delta / prevCount) * 100);

  return (
    <button onClick={onClick} className={`w-full rounded-xl border transition-all text-left shadow-sm p-3 overflow-hidden shrink-0 ${
      active
        ? (isDelay ? 'bg-rose-600 text-white border-rose-700' : isAdvance ? 'bg-amber-500 text-white border-amber-600' : isPending ? 'bg-blue-600 text-white border-blue-700' : 'bg-emerald-500 text-white border-emerald-600')
        : (isDelay ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20' : isAdvance ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/20' : isPending ? 'bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20' : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20')
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`block text-[6px] sm:text-[8px] font-black uppercase tracking-widest truncate ${
          active ? 'opacity-90' : (isDelay ? 'text-rose-500' : isAdvance ? 'text-amber-500' : isPending ? 'text-blue-500' : 'text-emerald-600')
        }`}>{type}</span>
        {prevCount !== undefined && (
          <div className={`flex items-center gap-0.5 text-[7px] font-black ${
            active ? 'text-white/80' : (isGood ? 'text-emerald-500' : isBad ? 'text-rose-500' : 'text-slate-400')
          }`}>
            {isUp ? <ChevronUp className="w-2.5 h-2.5" /> : delta < 0 ? <ChevronDown className="w-2.5 h-2.5" /> : null}
            {percentage.toFixed(0)}%
          </div>
        )}
      </div>
      {/* Trips count — big */}
      <div className="text-[14px] sm:text-2xl font-black tracking-tighter leading-none truncate">{count ?? 0}</div>
      {/* Efficiency % — small below */}
      <div className={`text-[8px] sm:text-[10px] font-bold mt-0.5 tracking-widest truncate ${
        active ? 'opacity-80' : (isDelay ? 'text-rose-400' : isAdvance ? 'text-amber-400' : isPending ? 'text-blue-400' : 'text-emerald-500')
      }`}>{eff || '0%'}</div>
      {prevCount !== undefined && (
        <div className="text-[6px] opacity-40 font-black uppercase tracking-tighter mt-1 truncate shrink-0">{prevPeriod || 'vs prev'}</div>
      )}
    </button>
  );
}

function StatusBadge({ status, label }: { status: string, label: string }) {
  const isSuccess = status === 'OnTime';
  const isWarning = status === 'Advance';
  const isDanger = status === 'Delay';
  const isPending = status === 'Belum Sampai';
  return (
    <div className={`inline-flex flex-col px-1.5 py-0.5 rounded-md text-[7px] sm:text-[10px] font-black tracking-widest border transition-all shadow-sm overflow-hidden ${isSuccess ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : isWarning ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : isDanger ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : isPending ? 'bg-sky-500/10 text-sky-600 border-sky-500/20' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
      <span className="uppercase truncate max-w-10 sm:max-w-none">{status}</span>
      <span className="text-[6px] sm:text-[8px] opacity-60 truncate max-w-10 sm:max-w-20 font-black uppercase mt-0.5">{label || '-'}</span>
    </div>
  );
}

function ModalHeader({ title, onClose }: any) {
  return (
    <div className="flex items-center justify-between mb-6 sm:mb-10 w-full overflow-hidden">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 overflow-hidden">
        <div className="w-1 h-5 sm:w-2 sm:h-8 bg-blue-600 rounded-full shrink-0" />
        <h3 className="text-sm sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none truncate">{title}</h3>
      </div>
      <button onClick={onClose} className="p-1.5 sm:p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all shrink-0">
        <X className="w-5 h-5 sm:w-7 sm:h-7" />
      </button>
    </div>
  );
}

function LegendItem({ color, label, isLine }: any) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0 overflow-hidden">
      <div className={isLine ? `w-3 h-0.5 sm:w-5 sm:h-1 rounded-full shrink-0` : `w-2 h-2 sm:w-3.5 sm:h-3.5 rounded-sm sm:rounded-md shrink-0`} style={{ backgroundColor: color }} />
      <span className="text-[6px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
    </div>
  );
}

function CustomTrendTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-2xl border border-slate-800 min-w-27.5 sm:min-w-40 overflow-hidden">
        <p className="text-[7px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1.5 truncate">{label}</p>
        <div className="space-y-1.5 overflow-hidden">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-3 sm:gap-4 overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-[7px] sm:text-[10px] font-black text-slate-300 uppercase tracking-tight truncate">{p.name}</span>
              </div>
              <span className="text-[9px] sm:text-xs font-black text-white shrink-0">{p.value}{p.name === 'onTimeRate' ? '%' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function AreaDropdown({ areas, selected, onChange }: { areas: string[]; selected: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
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
    ALL: 'bg-slate-500', JBK: 'bg-blue-500', NGORO: 'bg-orange-500', TMMIN: 'bg-red-500', SUMATERA: 'bg-emerald-500',
    PADANG: 'bg-violet-500', SULAWESI: 'bg-rose-500', KALIMANTAN: 'bg-cyan-500'
  };
  const getColor = (a: string) => AREA_COLORS[a] || 'bg-slate-400';
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="relative flex">
      <button ref={btnRef} onClick={handleOpen} type="button"
        className="flex items-center gap-2 pl-3 pr-3 py-2.5 h-[42px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm hover:border-blue-400 focus:ring-2 focus:ring-blue-500/30 min-w-[150px]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${getColor(selected)}`} />
        <span className="flex-1 text-left text-slate-700 dark:text-slate-200">{selected === 'ALL' ? 'ALL AREA' : selected}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[11000] pointer-events-none">
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
              <div style={{ padding: 12, borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94a3b8' }} />
                  <input
                    autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari area..."
                    style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc', border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, outline: 'none', color: isDark ? '#e2e8f0' : '#1e293b' }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: 256, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 }}>
                {filtered.map(a => (
                  <button key={a} type="button" onClick={() => { onChange(a); setOpen(false); setSearch(''); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px', textAlign: 'left', border: 'none', cursor: 'pointer',
                      backgroundColor: selected === a ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : 'transparent',
                    }}
                    onMouseEnter={e => { if (selected !== a) (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? 'rgba(30,41,59,0.6)' : '#f8fafc'; }}
                    onMouseLeave={e => { if (selected !== a) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColor(a)}`} />
                    <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', flex: 1, color: selected === a ? (isDark ? '#93c5fd' : '#2563eb') : (isDark ? '#cbd5e1' : '#374151'), letterSpacing: '0.05em' }}>
                      {a === 'ALL' ? '✦ ALL AREA' : a}
                    </span>
                    {selected === a && <CheckCircle2 style={{ width: 14, height: 14, color: '#3b82f6', flexShrink: 0 }} />}
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


