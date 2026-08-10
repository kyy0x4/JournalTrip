import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Navigation, 
  Building2,
  Search,
  ArrowRight,
  Calendar,
  RefreshCcw,
  X,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchFleetMonitoringData } from '../services/dataFetcher';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../context/NotificationContext';

// Status Types for Fleet
type FleetStatus = 'In Pool' | 'OTW PDC' | 'In PDC' | 'OTW Destination' | 'At Destination' | 'Finished';

interface FleetArmada {
  id: string;
  driverName: string;
  nopol: string;
  currentRitase: number;
  totalRitase: number;
  status: FleetStatus;
  lastUpdate: string;
  origin: string;
  destination: string;
  shift: string;
  areaCategory: 'TAM' | 'TMMIN' | 'JBK' | 'NGORO' | 'SUMATERA';
  isChangeShift: boolean;
  changeRitase: number;
  isDelayed: boolean;
  delayRitase: number;
  avatar_url?: string;
  allTrips: any[];
}

export default function FleetMonitoringPage({ isTAM = false }: { isTAM?: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [fleetData, setFleetData] = useState<FleetArmada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<FleetArmada | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  });

  // ── Notifikasi Berpotensi Delay (global context) ──
  const { pushNotification } = useNotifications();
  const seenDelayedRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchFleetMonitoringData(selectedDate);
    const TAM_AREAS = ['JBK', 'NGORO', 'SUMATERA'];
    const mappedData = (data || []).map((item: any) => ({
      ...item,
      areaCategory: item.project
    }));
    // For TAM users: hide TMMIN drivers (only show TAM project)
    const filtered = isTAM
      ? mappedData.filter((item: any) => {
          const area = (item.area || '').toUpperCase();
          const proj = (item.project || item.customer || item.Customer || '').toUpperCase();
          return TAM_AREAS.some(a => area.includes(a)) && !area.includes('SULAWESI') && !proj.includes('TMMIN');
        })
      : mappedData;
    setFleetData(filtered);
    setIsLoading(false);
  }, [selectedDate, isTAM]);

  // Deteksi delay baru: hanya notify yang belum pernah dilihat
  useEffect(() => {
    const delayed = fleetData.filter(f => f.isDelayed && f.delayRitase > 0);
    const keys = new Set(delayed.map(f => `${f.id}:${f.delayRitase}`));

    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      seenDelayedRef.current = keys;
      return;
    }

    for (const f of delayed) {
      const key = `${f.id}:${f.delayRitase}`;
      if (!seenDelayedRef.current.has(key)) {
        seenDelayedRef.current.add(key);
        pushNotification({
          driverName: f.driverName,
          nopol: f.nopol,
          ritase: f.delayRitase,
          area: (f as any).area || '',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }
  }, [fleetData, pushNotification]);

  useEscapeKey(() => setSelectedDriver(null), !!selectedDriver);

  useEffect(() => {
    loadData();

    // Real-time subscription
    const channel = supabase
      .channel('fleet-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadData();
      })
      .subscribe();

    // Polling periodik agar momen lewatnya jam plan tetap terdeteksi
    const interval = window.setInterval(() => {
      loadData();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [loadData]);

  const getStatusColor = (status: FleetStatus) => {
    switch (status) {
      case 'In Pool': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
      case 'OTW PDC': return 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';
      case 'In PDC': return 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400';
      case 'OTW Destination': return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400';
      case 'At Destination': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'Finished': return 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const filteredFleet = fleetData.filter(f => {
    const matchesSearch = f.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         f.nopol.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesShift = selectedShift === 'ALL' || (f as any).shift.toUpperCase().includes(selectedShift);

    let matchesArea = true;
    if (selectedArea !== 'ALL') {
      if (isTAM) {
        // For TAM users, filter by the actual area field (JBK, NGORO, SUMATERA)
        matchesArea = ((f as any).area || '').toUpperCase().includes(selectedArea);
      } else {
        // For OPS users, filter by project category (TAM or TMMIN)
        matchesArea = f.areaCategory === selectedArea;
      }
    }

    return matchesSearch && matchesShift && matchesArea;
  });

  const stats = useMemo(() => {
    return {
      total: filteredFleet.length,
      inPool: filteredFleet.filter(f => f.status === 'In Pool').length,
      otwPdc: filteredFleet.filter(f => f.status === 'OTW PDC').length,
      inPdc: filteredFleet.filter(f => f.status === 'In PDC').length,
      otwDest: filteredFleet.filter(f => f.status === 'OTW Destination').length,
      atDest: filteredFleet.reduce((acc, f) => acc + f.allTrips.filter((t: any) => t.actual_unloading).length, 0),
    };
  }, [filteredFleet]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="shrink-0">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Fleet Monitoring
            <span className="text-[10px] bg-red-600 text-white px-3 py-1 rounded-full animate-pulse tracking-widest font-black">LIVE</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">Real-time status armada & jadwal</p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Area & Shift Filter - Responsive Group */}
          <div className="grid grid-cols-1 sm:flex items-center gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-inner w-full sm:w-auto">
              {(isTAM ? ['ALL', 'JBK', 'NGORO', 'SUMATERA'] : ['ALL', 'TAM', 'TMMIN']).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedArea(p)}
                  className={`flex-1 sm:w-16 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    selectedArea === p 
                      ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-inner w-full sm:w-auto">
              {(['ALL', 'DAY', 'NIGHT'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedShift(s)}
                  className={`flex-1 sm:w-16 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    selectedShift === s 
                      ? 'bg-white dark:bg-slate-800 text-red-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Date Navigation Control */}
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex-1 sm:flex-none">
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors border-r border-slate-100 dark:border-slate-800"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
              
              <div 
                onClick={() => dateInputRef.current?.showPicker()}
                className="relative flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group/cal"
              >
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[10px] font-black text-slate-900 dark:text-white whitespace-nowrap uppercase tracking-widest">
                  {new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
                <input 
                  ref={dateInputRef}
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-auto cursor-pointer z-20"
                />
              </div>

              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors border-l border-slate-100 dark:border-slate-800"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="relative group flex-1 sm:flex-none">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-red-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white dark:bg-slate-900 rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-black focus:outline-none shadow-sm border border-slate-200 dark:border-slate-800 dark:text-white w-full sm:w-32 lg:w-40 uppercase tracking-widest"
              />
            </div>

            <button 
              onClick={loadData}
              className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-500 transition-all shrink-0"
            >
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Planning Armada', value: stats.total, icon: Truck, color: 'text-slate-500', bg: 'bg-slate-50' },
          { label: 'In Pool', value: stats.inPool, icon: Building2, color: 'text-slate-400', bg: 'bg-slate-50' },
          { label: 'OTW PDC', value: stats.otwPdc, icon: Navigation, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'In PDC', value: stats.inPdc, icon: MapPin, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'OTW Tujuan', value: stats.otwDest, icon: Navigation, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Sampai Tujuan', value: stats.atDest, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-2 group hover:shadow-md transition-all"
          >
            <div className={`p-3 rounded-2xl ${item.bg} dark:bg-slate-800 group-hover:scale-110 transition-transform`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{item.label}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── MONITORING TABLE (Desktop) & CARDS (Mobile) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-4xl shadow-sm overflow-hidden border border-slate-200/60 dark:border-slate-800">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-4"
            >
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-slate-800 last:border-0 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                      <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                    </div>
                  </div>
                  <div className="h-8 w-24 bg-slate-50 dark:bg-slate-800/50 rounded-full" />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Armada / Driver</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ritase</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Route</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filteredFleet.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedDriver(item)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                              {item.avatar_url ? (
                                <img src={item.avatar_url} alt={item.driverName} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-black text-slate-900 dark:text-white text-sm">{item.driverName}</p>
                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${item.areaCategory === 'TAM' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{item.areaCategory}</span>
                                {item.isChangeShift && (
                                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter">Rit {item.changeRitase} Change</span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 tracking-wider">{item.nopol} • {item.shift}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex gap-1">
                              {[...Array(item.totalRitase)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`w-1.5 h-1.5 rounded-full ${i < item.currentRitase ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`} 
                                />
                              ))}
                            </div>
                            <p className="text-[10px] font-black text-slate-500">{item.currentRitase} / {item.totalRitase}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{item.origin}</span>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{item.destination}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                            {item.isDelayed && (
                              <span className="text-[9px] font-black text-rose-600 animate-pulse flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Rit {item.delayRitase} Berpotensi Delay
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">{item.lastUpdate}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Cards */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFleet.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedDriver(item)}
                    className="p-5 space-y-4 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                          {item.avatar_url ? (
                            <img src={item.avatar_url} alt={item.driverName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 dark:text-white text-sm">{item.driverName}</p>
                            <span className={`px-1 py-0.5 rounded text-[6px] font-black uppercase ${item.areaCategory === 'TAM' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{item.areaCategory}</span>
                            {item.isChangeShift && (
                              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1 py-0.5 rounded text-[6px] font-black uppercase tracking-tighter">Change</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 tracking-wider">{item.nopol}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        {item.isDelayed && (
                          <span className="text-[8px] font-black text-rose-600 animate-pulse flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Rit {item.delayRitase} Delay
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500">{item.origin}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-900 dark:text-white">{item.destination}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Ritase</p>
                        <p className="text-xs font-black text-red-600">{item.currentRitase} / {item.totalRitase}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <div className="flex gap-1">
                        {[...Array(item.totalRitase)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full ${i < item.currentRitase ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`} 
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                        <Clock className="w-3 h-3" />
                        {item.lastUpdate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── DRIVER DETAILS MODAL ── */}
      {createPortal(
      <AnimatePresence>
        {selectedDriver && (
          <div className="fixed inset-0 z-20000 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDriver(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-4xl shadow-2xl overflow-y-auto border border-slate-200/60 dark:border-slate-800"
            >
              <div className="p-5 md:p-8">
                <div className="flex justify-between items-start mb-6 md:mb-10">
                  <div className="flex items-center gap-4 md:gap-5">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center overflow-hidden">
                      {selectedDriver.avatar_url ? (
                        <img src={selectedDriver.avatar_url} alt={selectedDriver.driverName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 md:gap-3">
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{selectedDriver.driverName}</h3>
                        <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">{selectedDriver.areaCategory}</span>
                      </div>
                      <p className="text-[10px] md:text-sm font-bold text-slate-400">{selectedDriver.nopol} • {selectedDriver.shift}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedDriver(null)}
                    className="p-2 md:p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Vertical Timeline */}
                  <div className="lg:col-span-3 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Timeline</h4>
                    </div>
                    
                    <div className="relative space-y-8 pl-4">
                      {/* Timeline Line */}
                      <div className="absolute left-5.75 top-4 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-800" />
                      
                      {selectedDriver.allTrips.map((trip: any, idx: number) => {
                        const isCompleted = trip.actual_unloading || trip.actual_out_pdc || trip.actual_in_pdc || trip.actual_outpool;
                        return (
                          <div key={idx} className="relative flex gap-6">
                            {/* Dot */}
                            <div className={`z-10 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 shadow-sm mt-1 shrink-0 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            
                            {/* Card */}
                            <div className={`flex-1 p-4 rounded-2xl border transition-all ${
                              trip.ritNo === selectedDriver.currentRitase 
                                ? 'bg-red-50/30 border-red-100 dark:bg-red-500/5 dark:border-red-900/30' 
                                : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                            }`}>
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                                    isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    R{trip.ritNo}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs font-black">
                                    <span className="text-slate-900 dark:text-white">{trip.pdc_muat}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-300" />
                                    <span className="text-slate-900 dark:text-white">{trip.pdc_bongkar}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                  {trip.isDelayed && (
                                    <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[7px] font-black uppercase animate-pulse">Berpotensi Delay</span>
                                  )}
                                  {trip.isChange && (
                                    <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[7px] font-black uppercase">Change Shift</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Plan DCCP</p>
                                  <p className="text-xs font-black text-slate-900 dark:text-white">{trip.plan_dccp || '--:--'}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Actual In PDC</p>
                                  <p className={`text-xs font-black ${trip.isDelayed ? 'text-rose-600' : (isCompleted && !trip.actual_in_pdc ? 'text-slate-400' : 'text-emerald-600')}`}>
                                    {trip.actual_in_pdc || (trip.actual_unloading || trip.actual_out_pdc ? 'Bypassed' : 'Waiting...')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info Sidebar */}
                  <div className="lg:col-span-2 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">Monitoring Guide</h4>
                    <div className="p-5 bg-blue-50/50 dark:bg-blue-500/5 rounded-3xl border border-blue-100/50 dark:border-blue-900/20">
                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 mb-4 uppercase tracking-widest">Parameter Logic</p>
                      <ul className="space-y-4">
                        <li className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />
                          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                            <span className="text-slate-800 dark:text-slate-300">Potential Delay:</span> Sistem mendeteksi jika unit belum masuk PDC melewati jam Plan DCCP.
                          </p>
                        </li>
                        <li className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />
                          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                            <span className="text-slate-800 dark:text-slate-300">Change Shift:</span> Ditandai otomatis jika Day Shift muat &gt; 17:00 atau Night Shift muat &gt; 05:00 pagi.
                          </p>
                        </li>
                        <li className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />
                          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                            <span className="text-slate-800 dark:text-slate-300">Cascading Effect:</span> Jika Rit 1 telat, status Rit berikutnya otomatis ikut terpantau delay.
                          </p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center px-8 sticky bottom-0">
                <p className="text-[10px] font-bold text-slate-400 italic">Data diperbarui secara real-time.</p>
                <button 
                  onClick={() => setSelectedDriver(null)}
                  className="px-8 py-3 bg-white dark:bg-slate-800 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/60 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Tutup Monitor
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
}
