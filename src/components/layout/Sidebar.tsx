import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Search,
  PanelLeftClose, PanelLeft,
  Route, BarChart3,
  Activity, Ticket, ClipboardCheck,
  Timer, LayoutDashboard, GraduationCap, ShieldCheck, UserCheck
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
  isAdmin?: boolean;
}

// Core Operations only — Analytics & Master Data are in the Navbar App Launcher
const NAV_ITEMS: { id: string; label: string; icon: ReactNode; sub?: string; path: string }[] = [
  { id: 'dashboard-overview', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, sub: 'Overview', path: '/dashboard' },
  { id: 'dashboard', label: 'Journal Trip', icon: <Route className="w-5 h-5" />, sub: 'Ritase Tracking', path: '/' },
  { id: 'monitoring', label: 'Monitoring', icon: <BarChart3 className="w-5 h-5" />, sub: 'Fleet Status', path: '/monitoring' },
  { id: 'standar-leadtime', label: 'Standar Leadtime', icon: <Timer className="w-5 h-5" />, sub: 'Reference Guide', path: '/standar-leadtime' },
  { id: 'tenko', label: 'Tenko', icon: <Activity className="w-5 h-5" />, sub: 'Health Check', path: '/tenko' },
  { id: 'driver-analytics', label: 'Driver Analytics', icon: <UserCheck className="w-5 h-5" />, sub: 'Violations & Coaching', path: '/driver-analytics' },
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
  isAdmin = false,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.id.includes(searchQuery.toLowerCase())
  );

  const showDriverPanel = location.pathname === '/';

  const activeStyle = (active: boolean) => active
    ? 'nav-item-active text-white'
    : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/[0.06] hover:text-slate-800 dark:hover:text-slate-100';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`
          fixed top-4 bottom-4 left-4 z-50 glass-panel rounded-3xl
          flex flex-col overflow-hidden
          transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${isOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}
          ${isCollapsed ? 'w-[76px]' : 'w-[260px]'}
        `}
      >
        {/* Gradient accent top strip */}
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-red-400/50 to-transparent" />

        {/* ── BRAND HEADER ── */}
        <div className={`h-19 flex items-center border-b border-slate-200/40 dark:border-white/[0.06] shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5 gap-3'}`}>
          <div className="w-12 h-12 shrink-0 flex items-center justify-center overflow-hidden p-1">
              <img
                src={isCollapsed ? Logo1 : Logo}
                alt="K Line"
                className="w-full h-full object-contain transition-all duration-500"
                title="K Line"
              />
            </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-lg font-black text-slate-900 dark:text-white truncate tracking-tight">
                K Line
                <span className="text-red-500">.</span>
              </p>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.18em] truncate">
                Fleet Monitoring
              </p>
            </div>
          )}
          <button onClick={onClose} className="md:hidden p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg text-slate-400">
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
                  ${activeStyle(active)}
                `}
              >
                <span className={`shrink-0 transition-transform ${active ? 'scale-100' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <>
                    <div className="text-left flex-1 overflow-hidden">
                      <p className="text-sm font-bold truncate leading-tight">{item.label}</p>
                      <p className={`text-[9px] truncate ${active ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{item.sub}</p>
                    </div>
                    {active && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)] shrink-0"
                      />
                    )}
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
          {isAdmin && (
            <Link
              to="/admin-drivers"
              onClick={() => { if (window.innerWidth < 768) onClose(); }}
              title={isCollapsed ? 'Admin Foto Driver' : undefined}
              className={`
                w-full flex items-center rounded-xl transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'}
                ${activeStyle(location.pathname.startsWith('/admin-drivers'))}
              `}
            >
              <span className={`shrink-0 transition-transform ${location.pathname.startsWith('/admin-drivers') ? 'scale-100' : 'group-hover:scale-110'}`}>
                <User className="w-5 h-5" />
              </span>
              {!isCollapsed && (
                <>
                  <div className="text-left flex-1 overflow-hidden">
                    <p className="text-sm font-bold truncate leading-tight">Admin Foto</p>
                    <p className={`text-[9px] truncate ${location.pathname.startsWith('/admin-drivers') ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>Manajemen Driver</p>
                  </div>
                  {location.pathname.startsWith('/admin-drivers') && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="w-1.5 h-1.5 rounded-full bg-white/90 shrink-0"
                    />
                  )}
                </>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg border dark:border-slate-700">
                  Admin Foto Driver
                </div>
              )}
            </Link>
          )}
        </nav>

        {/* ── DRIVER PANEL (only on Journal Trip) ── */}
        <AnimatePresence>
          {showDriverPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col flex-1 overflow-hidden border-t border-slate-200/40 dark:border-white/[0.06] mt-2"
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
                      className="w-full bg-white/60 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.08] rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-400/40 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
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
                            ? 'bg-white/70 dark:bg-white/[0.06] ring-1 ring-red-500/25 text-red-700 dark:text-red-300 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-100'}
                        `}
                      >
                        <div className="relative shrink-0">
                          {driver.avatar ? (
                            <img src={driver.avatar} alt={driver.name}
                              className="w-9 h-9 rounded-full object-cover border-2 border-white/80 dark:border-white/10 shadow-sm" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white/80 dark:border-white/10 shadow-sm">
                              <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                          )}
                          {selectedDriverId === driver.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-[0_0_6px_rgba(217,119,87,0.8)]"
                            />
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
        <div className="p-3 border-t border-slate-200/40 dark:border-white/[0.06] shrink-0 hidden md:block">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-2.5 hover:bg-white/60 dark:hover:bg-white/[0.06] rounded-xl text-slate-400 dark:text-slate-500 transition-colors group"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed
              ? <PanelLeft className="w-5 h-5 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
              : <PanelLeftClose className="w-5 h-5 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
            }
          </button>
        </div>
      </motion.aside>
    </>
  );
}
