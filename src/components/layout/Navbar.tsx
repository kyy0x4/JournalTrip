import { useEffect, useRef, useState, useCallback } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, Sun, Moon,
  ChevronDown, Download, LogOut, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import Logo from '../../image/Logo.png';
import NotificationBell from './NotificationBell';
import MobileNav from './MobileNav';
import JournalTripControls from '../dashboard/JournalTripControls';
import { filterNavGroups, NavGroup } from '../../constants/navigation';

interface NavbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedShift: 'Day' | 'Night';
  onShiftChange: (shift: 'Day' | 'Night') => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  session?: any;
  isTAM?: boolean;
  isAdmin?: boolean;
}

export default function Navbar({
  selectedDate,
  onDateChange,
  selectedShift,
  onShiftChange,
  isSidebarOpen,
  onToggleSidebar,
  isSidebarCollapsed,
  theme,
  onThemeToggle,
  session,
  isTAM = false,
  isAdmin = false,
}: NavbarProps) {
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  const navBarRef = useRef<HTMLElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const groups = filterNavGroups(isTAM, isAdmin);

  // Tutup dropdown saat klik di luar navbar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (navBarRef.current && !navBarRef.current.contains(target)) {
        setOpenGroup(null);
        setIsProfileOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tutup grup saat pindah halaman
  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  const isItemActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const isGroupActive = (group: NavGroup) => group.items.some(item => isItemActive(item.path));

  const openGroupWithDelay = useCallback((id: string | null) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (id === null) {
      hoverTimeoutRef.current = setTimeout(() => setOpenGroup(null), 150);
    } else {
      hoverTimeoutRef.current = setTimeout(() => setOpenGroup(id), 150);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  useEscapeKey(() => setOpenGroup(null), !!openGroup);
  useEscapeKey(() => setIsProfileOpen(false), !!isProfileOpen);
  useEscapeKey(() => setIsMobileNavOpen(false), !!isMobileNavOpen);

  const formatUserName = (email: string) => {
    if (!email) return 'User';
    const namePart = email.split('@')[0];
    return namePart
      .split(/[\._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const isDashboard = location.pathname === '/journal-trip';

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const appElement = document.body;
      const sidebarElement = document.querySelector('aside');
      const isDarkMode = document.documentElement.classList.contains('dark');
      if (isDarkMode) document.documentElement.classList.remove('dark');
      const originalSidebarHeight = sidebarElement ? (sidebarElement as HTMLElement).style.height : '';
      if (sidebarElement) {
        (sidebarElement as HTMLElement).style.height = `${appElement.scrollHeight}px`;
      }
      await new Promise(resolve => setTimeout(resolve, 800));
      // Dynamic import: library PDF baru di-load pas user klik export,
      // biar nggak ikut di bundle awal (jspdf + html2canvas ~500 KB)
      const [htmlToImage, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const dataUrl = await htmlToImage.toJpeg(appElement, {
        quality: 0.8,
        backgroundColor: '#ffffff',
        width: appElement.clientWidth,
        height: appElement.scrollHeight,
        pixelRatio: 1.5,
      });
      const pdfWidth = appElement.clientWidth * 0.264583;
      const pdfHeight = appElement.scrollHeight * 0.264583;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'l' : 'p',
        unit: 'mm',
        format: [pdfHeight, pdfWidth],
      });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`JournalTrip_Report_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.pdf`);
      if (sidebarElement) {
        (sidebarElement as HTMLElement).style.height = originalSidebarHeight;
      }
      if (isDarkMode) document.documentElement.classList.add('dark');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Gagal export PDF. Silakan coba kembali.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <nav
        ref={navBarRef}
        className={`
          fixed top-0 inset-x-0 z-50 h-14
          border-b border-slate-200/60 dark:border-white/[0.06]
          bg-white/85 dark:bg-[#151210]/85 backdrop-blur-xl
          flex items-center px-3 md:px-5 gap-2 md:gap-4
        `}
      >
        {/* ── Hamburger (mobile nav) ── */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsMobileNavOpen(true)}
          className="p-2 -ml-1 text-slate-500 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0 lg:hidden"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </motion.button>

        {/* ── Brand (hidden di mobile — hemat tempat) ── */}
        <Link to="/dashboard" className="hidden sm:flex items-center shrink-0">
          <img src={Logo} alt="KMDI" className="h-7 object-contain" />
        </Link>

        {/* ── Users button (mobile, only on Journal Trip) ── */}
        {isDashboard && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl transition-colors shrink-0 md:hidden ${
              isSidebarOpen
                ? 'bg-red-600 text-white'
                : 'text-slate-500 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="Buka daftar driver"
          >
            <Users className="w-5 h-5" />
          </motion.button>
        )}

        {/* ── Desktop Nav Groups ── */}
        <div className="hidden lg:flex items-center gap-0.5 ml-2">
          {groups.map(group => {
            const groupActive = isGroupActive(group);
            const isOpen = openGroup === group.id;
            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => openGroupWithDelay(group.id)}
                onMouseLeave={() => openGroupWithDelay(null)}
              >
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold transition-colors
                    ${isOpen || groupActive
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'}
                  `}
                >
                  {group.label}
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="opacity-60"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-full left-0 mt-1.5 min-w-[260px] p-1.5 rounded-xl border border-slate-200/60 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 z-50"
                    >
                      <p className="px-3 pt-2 pb-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        {group.label}
                      </p>
                      {group.items.map(item => {
                        const active = isItemActive(item.path);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.id}
                            to={item.path}
                            onClick={() => setOpenGroup(null)}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group/item
                              ${active
                                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'}
                            `}
                          >
                            <span className={`shrink-0 ${active ? 'text-red-500' : 'text-slate-400 dark:text-slate-500 group-hover/item:text-red-400'}`}>
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="flex-1 text-left min-w-0">
                              <span className="block text-xs font-bold leading-tight truncate">{item.label}</span>
                              <span className={`block text-[9px] font-semibold leading-tight truncate ${active ? 'text-red-500/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                {item.sub}
                              </span>
                            </span>
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2 md:gap-3">

          {/* ── JOURNAL TRIP Controls (Date & Shift) — desktop only, mobile pindah ke halaman ── */}
          <AnimatePresence>
            {isDashboard && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="hidden md:block"
              >
                <JournalTripControls
                  selectedDate={selectedDate}
                  onDateChange={onDateChange}
                  selectedShift={selectedShift}
                  onShiftChange={onShiftChange}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Export PDF Button ── */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleExportPDF}
            disabled={isExporting}
            className="hidden md:flex relative p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all shadow-sm outline-none ring-0 disabled:opacity-50"
            title="Export current page to PDF"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </motion.button>

          {/* ── Notification Bell ── */}
          <NotificationBell />

          {/* ── Theme Toggle ── */}
          <motion.button
            whileTap={{ scale: 0.9, rotate: 15 }}
            onClick={(e) => { e.preventDefault(); onThemeToggle(); }}
            className="relative p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm outline-none ring-0"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'light' ? (
                <motion.span key="moon" initial={{ opacity: 0, rotate: -30, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 30, scale: 0.7 }} transition={{ duration: 0.2 }}>
                  <Moon className="w-4 h-4" />
                </motion.span>
              ) : (
                <motion.span key="sun" initial={{ opacity: 0, rotate: 30, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -30, scale: 0.7 }} transition={{ duration: 0.2 }}>
                  <Sun className="w-4 h-4 text-yellow-400" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* ── Profile Dropdown ── */}
          {session && (
            <div ref={profileRef} className="relative">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setIsProfileOpen(o => !o); setOpenGroup(null); }}
                className="flex items-center gap-1.5 md:gap-2 pl-1.5 pr-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm outline-none focus:outline-none focus:ring-0 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-red-600/20">
                  {session.user?.email ? formatUserName(session.user.email).charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[96px]">
                  {session.user?.email ? formatUserName(session.user.email).split(' ')[0] : 'User'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </motion.button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 z-200 min-w-[224px] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
                      <p className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">LOGGED IN AS</p>
                      <p className="text-xs font-black text-slate-800 dark:text-white mt-2 uppercase truncate">
                        {session.user?.email ? formatUserName(session.user.email) : 'User'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 truncate">
                        {session.user?.email || ''}
                      </p>
                    </div>
                    <div className="p-1.5">
                      {isAdmin && (
                        <Link
                          to="/admin-drivers"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-colors text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 mb-0.5"
                        >
                          <Users className="w-4 h-4 shrink-0 text-red-500" />
                          Admin Foto Driver
                        </Link>
                      )}
                      <motion.button
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          setIsProfileOpen(false);
                          await supabase.auth.signOut();
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-left w-full rounded-xl transition-colors text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <LogOut className="w-4 h-4 shrink-0 text-red-500" />
                        Sign Out
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </nav>

      {/* ── Mobile Navigation Drawer ── */}
      <MobileNav
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        groups={groups}
      />
    </>
  );
}
