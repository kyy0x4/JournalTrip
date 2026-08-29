import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Search,
  PanelLeft, PanelLeftClose,
} from 'lucide-react';
import { Driver } from '../../types';
import Logo from '../../image/Logo.png';

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
}

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
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.id.includes(searchQuery.toLowerCase())
  );

  const openPanelWithDelay = (open: boolean) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setPanelOpen(open), open ? 100 : 200);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* ── ICON RAIL (desktop) — ala CoinGlass ── */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="hidden md:flex fixed top-14 bottom-0 left-0 z-40 w-16 flex-col items-center py-3 gap-3 border-r border-slate-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-[#151210]/70 backdrop-blur-xl"
        onMouseEnter={() => openPanelWithDelay(true)}
        onMouseLeave={() => openPanelWithDelay(false)}
      >
        {/* Logo */}
        <div className="w-10 h-10 flex items-center justify-center overflow-hidden p-1 rounded-xl border border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.04]">
          <img
            src={Logo}
            alt="KMDI"
            className="w-full h-full object-contain"
            title="KMDI"
          />
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-slate-200/70 dark:bg-white/[0.08]" />

        {/* Users rail icon — buka flyout driver */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setPanelOpen(o => !o)}
          className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
            panelOpen
              ? 'bg-red-600 text-white'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-red-500'
          }`}
          title="Active Drivers"
          aria-label="Active Drivers"
        >
          <User className="w-5 h-5" />
          {drivers.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
          )}
        </motion.button>

        {/* Collapse toggle (rail button) */}
        <button
          onClick={onToggleCollapse}
          className="mt-auto w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed
            ? <PanelLeft className="w-5 h-5" />
            : <PanelLeftClose className="w-5 h-5" />
          }
        </button>
      </motion.aside>

      {/* ── FLYOUT PANEL (desktop) — muncul di samping rail saat hover Users ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="hidden md:block fixed top-14 bottom-0 left-16 z-30 w-[280px] border-r border-slate-200/60 dark:border-white/[0.06] bg-white/95 dark:bg-[#1c1815]/95 backdrop-blur-xl overflow-hidden"
            onMouseEnter={() => openPanelWithDelay(true)}
            onMouseLeave={() => openPanelWithDelay(false)}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-2 shrink-0">
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Active Drivers</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari driver..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-white/60 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.08] rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-400/40 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

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
                      className={`
                        w-full flex items-center rounded-xl transition-all group
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

      {/* ── MOBILE: drawer driver picker ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed top-0 bottom-0 left-0 w-[300px] max-w-[85vw] z-[70] md:hidden bg-white dark:bg-[#1c1815] border-r border-slate-200/60 dark:border-white/[0.06] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200/40 dark:border-white/[0.06]">
              <img src={Logo} alt="KMDI" className="h-7 object-contain" />
              <button
                onClick={onClose}
                className="ml-auto p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Driver list */}
            <div className="flex-1 overflow-hidden flex flex-col">
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
                        onClick={() => { onDriverSelect(driver.id); onClose(); }}
                        className={`
                          w-full flex items-center rounded-xl transition-all gap-3 p-2.5
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
                        <div className="text-left overflow-hidden flex-1">
                          <p className="text-xs font-bold truncate">{driver.name}</p>
                          <p className="text-[9px] font-black uppercase tracking-wider text-red-500/70 dark:text-red-300/80 truncate">
                            {driver.noPolisi || `#${driver.id.slice(0, 6)}`}
                          </p>
                        </div>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
