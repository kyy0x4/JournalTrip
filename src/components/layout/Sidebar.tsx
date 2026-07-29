import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Search,
  PanelLeftClose, PanelLeft,
  Route, ChevronRight, BarChart3,
  Activity, Ticket, ClipboardCheck,
  Timer, LayoutDashboard, GraduationCap, ShieldCheck
} from 'lucide-react';
import { Driver } from '../../types';
import Logo from '../../image/Logo.png';
import Logo1 from '../../image/logo1.webp';

interface SidebarProps {
  drivers: Driver[];
  selectedDriverId: string;
  onDriverSelect: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isLoading?: boolean;
  theme: 'light' | 'dark';
  selectedShift?: 'Day' | 'Night';
  onShiftChange?: (shift: 'Day' | 'Night') => void;
  selectedArea?: string;
  isTAM?: boolean;
}

// Core Operations only — Analytics & Master Data are in the Navbar App Launcher
const NAV_ITEMS: { id: string; label: string; icon: ReactNode; sub?: string; path: string }[] = [
  { id: 'dashboard-overview', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, sub: 'Overview', path: '/dashboard' },
  { id: 'dashboard', label: 'Journal Trip', icon: <Route className="w-5 h-5" />, sub: 'Ritase Tracking', path: '/' },
  { id: 'monitoring', label: 'Monitoring', icon: <BarChart3 className="w-5 h-5" />, sub: 'Fleet Status', path: '/monitoring' },
  { id: 'standar-leadtime', label: 'Standar Leadtime', icon: <Timer className="w-5 h-5" />, sub: 'Reference Guide', path: '/standar-leadtime' },
  { id: 'tenko', label: 'Tenko', icon: <Activity className="w-5 h-5" />, sub: 'Health Check', path: '/tenko' },
  { id: 'p2h', label: 'P2H', icon: <ClipboardCheck className="w-5 h-5" />, sub: 'Checklist', path: '/p2h' },
  { id: 'gatepass', label: 'Gatepass', icon: <Ticket className="w-5 h-5" />, sub: 'Control Room', path: '/gatepass' },
  { id: 'training', label: 'Training Center', icon: <GraduationCap className="w-5 h-5" />, sub: 'Analytics', path: '/training' },
  { id: 'kr-schedule', label: 'Jadwal KR', icon: <ShieldCheck className="w-5 h-5" />, sub: 'Operasional', path: '/kr-schedule' },
];


const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -15 },
  show: { opacity: 1, x: 0 }
};

export default function Sidebar({
  drivers,
  selectedDriverId,
  onDriverSelect,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  isLoading,
  theme,
  selectedShift = 'Day',
  onShiftChange,
  selectedArea = 'JBK',
  isTAM = false,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.id.includes(searchQuery.toLowerCase())
  );

  const showDriverPanel = location.pathname === '/';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full bg-white dark:bg-[#0f172a] border-r border-slate-200/60 dark:border-slate-800/60
        transition-all duration-500 ease-in-out flex flex-col shadow-xl md:shadow-sm
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'w-18' : 'w-64'}
      `}>

        {/* ── BRAND HEADER ── */}
        <div className={`h-19 flex items-center border-b border-slate-100 dark:border-slate-800 shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
          <div className="w-15 h-15 shrink-0 flex items-center justify-center overflow-hidden p-1">
              <img 
                src={isCollapsed ? Logo1 : Logo} 
                alt="K Line" 
                className="w-full h-full object-contain transition-all duration-500" 
                title="K Line"
              />
            </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-lg font-black text-red-600 dark:text-red-500 truncate tracking-tight">K Line</p>
            </div>
          )}
          <button onClick={onClose} className="md:hidden p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── MAIN NAVIGATION ── */}
        <nav className="px-3 pt-4 pb-2 space-y-1 shrink-0">
          {!isCollapsed && (
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3">Main Menu</p>
          )}
          {NAV_ITEMS.filter(item => isTAM ? !['p2h', 'gatepass'].includes(item.id) : true).map(item => {
            const active = item.path === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => { if (window.innerWidth < 768) onClose(); }}
                title={isCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center rounded-xl transition-all duration-200 group relative
                  ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'}
                  ${active
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'}
                `}
              >
                <span className={`shrink-0 transition-transform ${active ? 'scale-100' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <>
                    <div className="text-left flex-1 overflow-hidden">
                      <p className="text-sm font-bold truncate leading-tight">{item.label}</p>
                      <p className={`text-[9px] truncate ${active ? 'text-red-200' : 'text-slate-400 dark:text-slate-500'}`}>{item.sub}</p>
                    </div>
                    {active && <ChevronRight className="w-4 h-4 text-red-300 dark:text-red-400 shrink-0" />}
                  </>
                )}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg border dark:border-slate-700">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── DRIVER PANEL (only on Journal Trip) ── */}
        <AnimatePresence>
          {showDriverPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col flex-1 overflow-hidden border-t border-slate-100 dark:border-slate-800 mt-2"
            >
              {/* Driver Panel Header */}
              {!isCollapsed && (
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Active Drivers</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari driver..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-400 dark:focus:border-red-500/50 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Driver List */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex-1 overflow-y-auto px-3 py-2 space-y-1 driver-list-scrollbar"
              >
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-7 h-7 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Memuat...</p>
                  </div>
                ) : (
                  <>
                    {filteredDrivers.map((driver) => (
                      <motion.button
                        key={driver.id}
                        variants={itemVariants}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { onDriverSelect(driver.id); if (window.innerWidth < 768) onClose(); }}
                        title={isCollapsed ? driver.name : undefined}
                        className={`
                          w-full flex items-center rounded-xl transition-all group relative
                          ${isCollapsed ? 'justify-center p-2' : 'gap-3 p-2.5'}
                          ${selectedDriverId === driver.id
                            ? 'bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20 text-red-700 dark:text-red-300'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}
                        `}
                      >
                        <div className="relative shrink-0">
                          {driver.avatar ? (
                            <img src={driver.avatar} alt={driver.name}
                              className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                              <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                          )}
                          {selectedDriverId === driver.id && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="text-left overflow-hidden flex-1">
                            <p className="text-xs font-bold truncate">{driver.name}</p>
                            <p className="text-[9px] font-black uppercase tracking-wider text-red-500/70 dark:text-red-300/80 truncate">
                              {driver.noPolisi || `#${driver.id.slice(0, 6)}`}
                            </p>
                          </div>
                        )}
                        {isCollapsed && (
                          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg border dark:border-slate-700">
                            {driver.name}
                          </div>
                        )}
                      </motion.button>
                    ))}
                    {filteredDrivers.length === 0 && (
                      <div className="text-center py-8 px-3 space-y-3">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic">
                          {searchQuery
                            ? 'Driver tidak ditemukan'
                            : `Tidak ada trip ${selectedShift} Shift di ${selectedArea}`}
                        </p>
                        {!searchQuery && onShiftChange && (
                          <button
                            type="button"
                            onClick={() => onShiftChange(selectedShift === 'Day' ? 'Night' : 'Day')}
                            className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                          >
                            Coba {selectedShift === 'Day' ? 'Night' : 'Day'} Shift →
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
              </motion.div>
          )}
        </AnimatePresence>



        {/* ── COLLAPSE TOGGLE (Desktop only) ── */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 shrink-0 hidden md:block">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl text-slate-400 dark:text-slate-500 transition-colors group"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed
              ? <PanelLeft className="w-5 h-5 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
              : <PanelLeftClose className="w-5 h-5 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
            }
          </button>
        </div>
      </aside>
    </>
  );
}
