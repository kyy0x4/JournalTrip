import { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Menu, X, Sun, Moon,
  ChevronDown, Download, LogOut,
  Clock, Leaf, TreePine, Users, LayoutGrid, MapPin, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import Logo1 from '../../image/logo1.webp';
import NotificationBell from './NotificationBell';

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

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Journal Trip', sub: 'Ritase & Driver Tracking' },
  '/monitoring': { title: 'Fleet Monitoring', sub: 'Live Status & Schedule' },
  '/tenko': { title: 'Tenko Health Check', sub: 'Driver Health Verification' },
  '/gatepass': { title: 'Gatepass Control', sub: 'Dispatch & Fleet Readiness' },
  '/leadtime': { title: 'LeadTime Center', sub: 'Performance & Delay Analytics' },
  '/drivers': { title: 'Drivers Registry', sub: 'Data Master Pengemudi' },
  '/eco': { title: 'Monitoring Driving Behavior', sub: 'Safety Analytics Dashboard' },
  '/carbon': { title: 'Carbon Neutral', sub: 'Carbon Footprint & Environmental Impact' },
  '/training': { title: 'Training Center', sub: 'Analytics & Driver Development' },
  '/kr-schedule': { title: 'Jadwal KR', sub: 'Schedule Keamanan & Ketertiban' },
  '/admin-drivers': { title: 'Admin Foto Driver', sub: 'Manajemen Foto & Dokumentasi' },
};

// Analytics & Master Data items for the App Launcher
const LAUNCHER_ITEMS = [
  {
    id: 'leadtime',
    label: 'LeadTime',
    sub: 'Performance Analytics',
    path: '/leadtime',
    icon: <Clock className="w-6 h-6" />,
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/20',
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'eco',
    label: 'Eco Driving',
    sub: 'Safety Analytics',
    path: '/eco',
    icon: <Leaf className="w-6 h-6" />,
    gradient: 'from-emerald-500 to-green-600',
    glow: 'shadow-emerald-500/20',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'route-analytics',
    label: 'Route Analytics',
    sub: 'Segment Analysis',
    path: '/route-analytics',
    icon: <MapPin className="w-6 h-6" />,
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/20',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'carbon',
    label: 'Carbon Neutral',
    sub: 'Carbon Footprint',
    path: '/carbon',
    icon: <TreePine className="w-6 h-6" />,
    gradient: 'from-teal-500 to-cyan-600',
    glow: 'shadow-teal-500/20',
    bg: 'bg-teal-50 dark:bg-teal-500/10',
    text: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'drivers',
    label: 'Drivers',
    sub: 'Data Pengemudi',
    path: '/drivers',
    icon: <Users className="w-6 h-6" />,
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/20',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
  },
];

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
  const dateInputRef = useRef<HTMLInputElement>(null);
  const shiftRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Close dropdowns when clicking anywhere outside them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (shiftRef.current && !shiftRef.current.contains(target)) setIsShiftOpen(false);
      if (launcherRef.current && !launcherRef.current.contains(target)) setIsLauncherOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatUserName = (email: string) => {
    if (!email) return 'User';
    const namePart = email.split('@')[0];
    return namePart
      .split(/[\._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getPageInfo = () => {
    if (location.pathname.startsWith('/drivers/')) {
      return { title: 'Driver Profile', sub: 'Detail Data & History' };
    }
    return PAGE_TITLES[location.pathname] || PAGE_TITLES['/'];
  };

  const pageInfo = getPageInfo();
  const isDay = selectedShift === 'Day';
  const isDashboard = location.pathname === '/';

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
  useEscapeKey(() => setIsShiftOpen(false), !!isShiftOpen);
  useEscapeKey(() => setIsProfileOpen(false), !!isProfileOpen);
  useEscapeKey(() => setIsLauncherOpen(false), !!isLauncherOpen);


  return (
    <nav className={`
      fixed top-4 z-50 right-4
      glass-panel rounded-2xl
      h-16 flex items-center px-3 md:px-5
      transition-all duration-500 gap-4
      ${isSidebarCollapsed ? 'md:left-[100px]' : 'md:left-[284px]'} left-0
    `}>

      {/* ── Hamburger (mobile) ── */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onToggleSidebar}
        className="p-2 -mr-1 text-slate-500 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0 md:hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isSidebarOpen ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Menu className="w-5 h-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Page Title ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="hidden md:flex shrink-0 items-center gap-3"
        >
          <img src={Logo1} alt="K Line" className="h-8 object-contain" />
          <div>
            <h2 className="text-base font-black text-red-600 dark:text-red-400 leading-tight">{pageInfo.title}</h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{pageInfo.sub}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* ── JOURNAL TRIP Controls (Date & Shift) ── */}
        <AnimatePresence>
          {isDashboard && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 md:gap-3"
            >
              {/* Date Picker */}
              <motion.div
                whileTap={{ scale: 0.97 }}
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl shadow-inner outline-none ring-0 cursor-pointer"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={e => { onDateChange(e.target.value); e.target.blur(); }}
                  className="text-[11px] font-black text-slate-800 dark:text-white border-none focus:ring-0 cursor-pointer p-0 bg-transparent outline-none w-25"
                />
              </motion.div>

              {/* Shift Dropdown */}
              <div ref={shiftRef} className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setIsShiftOpen(o => !o); setIsLauncherOpen(false); }}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-all outline-none focus:outline-none focus:ring-0 font-black text-[10px] ${
                    isDay
                      ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-300'
                      : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300'
                  }`}
                >
                  <motion.span key={selectedShift} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    {isDay ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </motion.span>
                  <span>{selectedShift} Shift</span>
                  <motion.span animate={{ rotate: isShiftOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </motion.button>

                {isShiftOpen && (
                  <div className="fixed inset-0 z-199" onClick={() => setIsShiftOpen(false)} />
                )}

                <AnimatePresence>
                  {isShiftOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="absolute top-full right-0 sm:-right-4 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 z-200 min-w-40 overflow-hidden"
                    >
                      <div className="p-1.5 space-y-0.5">
                        <motion.button
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { onShiftChange('Day'); setIsShiftOpen(false); }}
                          className={`flex items-center gap-3 px-3 py-2.5 text-left w-full rounded-xl transition-colors text-xs font-black uppercase tracking-wider ${
                            selectedShift === 'Day'
                              ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300'
                              : 'text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Sun className={`w-4 h-4 ${selectedShift === 'Day' ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'}`} />
                          Day Shift
                          {selectedShift === 'Day' && (
                            <motion.div layoutId="shiftIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />
                          )}
                        </motion.button>

                        <motion.button
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { onShiftChange('Night'); setIsShiftOpen(false); }}
                          className={`flex items-center gap-3 px-3 py-2.5 text-left w-full rounded-xl transition-colors text-xs font-black uppercase tracking-wider ${
                            selectedShift === 'Night'
                              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
                              : 'text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Moon className={`w-4 h-4 ${selectedShift === 'Night' ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
                          Night Shift
                          {selectedShift === 'Night' && (
                            <motion.div layoutId="shiftIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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

        {/* ── APP LAUNCHER (9-Dots Mega Menu) ── */}
        <div ref={launcherRef} className="relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setIsLauncherOpen(o => !o); setIsProfileOpen(false); setIsShiftOpen(false); }}
            className={`relative p-2.5 rounded-xl transition-all shadow-sm outline-none ring-0 ${
              isLauncherOpen
                ? 'bg-red-600 text-white shadow-red-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="App Launcher — Analytics & Master Data"
          >
            <motion.span
              animate={{ rotate: isLauncherOpen ? 45 : 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="block"
            >
              <LayoutGrid className="w-4 h-4" />
            </motion.span>
          </motion.button>

          {/* Mega Menu Dropdown */}
          <AnimatePresence>
            {isLauncherOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: -10 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="absolute top-full right-0 mt-3 w-[300px] sm:w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60 rounded-3xl shadow-2xl shadow-slate-900/15 dark:shadow-black/50 z-[200] overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">App Launcher</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1">Analytics & Master Data</p>
                </div>

                {/* Grid Items */}
                <div className="p-3 grid grid-cols-2 gap-2">
                  {LAUNCHER_ITEMS.filter(item => isTAM ? !['carbon', 'drivers'].includes(item.id) : true).map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                    >
                      <Link
                        to={item.path}
                        onClick={() => setIsLauncherOpen(false)}
                        className={`flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all group cursor-pointer
                          ${location.pathname === item.path
                            ? `${item.bg} border-current ${item.text} shadow-md ${item.glow}`
                            : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-100/80 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-md hover:bg-white dark:hover:bg-slate-800'
                          }`}
                      >
                        <div className={`p-2 rounded-xl transition-all ${
                          location.pathname === item.path
                            ? `bg-linear-to-br ${item.gradient} text-white shadow-lg ${item.glow}`
                            : `${item.bg} ${item.text} group-hover:bg-linear-to-br group-hover:${item.gradient} group-hover:text-white group-hover:shadow-md group-hover:${item.glow}`
                        }`}>
                          {item.icon}
                        </div>
                        <div>
                          <p className={`text-xs font-black leading-tight ${
                            location.pathname === item.path ? item.text : 'text-slate-800 dark:text-slate-100'
                          }`}>{item.label}</p>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{item.sub}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold italic">
                    Core Operations tersedia di Sidebar kiri
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Profile Dropdown ── */}
        {session && (
          <div ref={profileRef} className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setIsProfileOpen(o => !o); setIsLauncherOpen(false); }}
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
                        <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" />
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
  );
}
