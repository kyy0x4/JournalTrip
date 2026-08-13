import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Header from './components/dashboard/Header';
import RitaseTracking from './components/dashboard/RitaseTracking';
import LoadingScreen from './components/common/LoadingScreen';
import DelayNotificationStack from './components/common/DelayNotificationStack';
import { NotificationProvider } from './context/NotificationContext';

const DriversPage = lazy(() => import('./pages/DriversPage'));
const DriverDetailPage = lazy(() => import('./pages/DriverDetailPage'));
const FleetMonitoringPage = lazy(() => import('./pages/FleetMonitoringPage'));
const EcoDrivingPage = lazy(() => import('./pages/EcoDrivingPage'));
const LeadTimePage = lazy(() => import('./pages/LeadTimePage'));
const StandarLeadtimePage = lazy(() => import('./pages/StandarLeadtimePage'));
const CarbonNeutralPage = lazy(() => import('./pages/CarbonNeutralPage'));
const TenkoPage = lazy(() => import('./pages/TenkoPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RouteAnalyticsPage = lazy(() => import('./pages/RouteAnalyticsPage'));
const TrainingDashboardPage = lazy(() => import('./pages/TrainingDashboardPage'));
const KRDashboardPage = lazy(() => import('./pages/KRDashboardPage'));
const AdminDriversPage = lazy(() => import('./pages/AdminDriversPage'));
const DriverAnalyticsPage = lazy(() => import('./pages/DriverAnalyticsPage'));

import Footer from './components/layout/Footer';
import { fetchDashboardData, fetchActiveDrivers, getDefaultOperationalShift } from './services/dataFetcher';
import { Ritase, Driver } from './types';
import { supabase } from './lib/supabase';
import { SpeedInsights } from "@vercel/speed-insights/react"

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]);
  const [selectedArea, setSelectedArea] = useState('JBK');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedShift, setSelectedShift] = useState<'Day' | 'Night'>(getDefaultOperationalShift);
  const [ritases, setRitases] = useState<Ritase[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | undefined>();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDriversLoading, setIsDriversLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (savedTheme) return savedTheme;
      
      const hour = new Date().getHours();
      return (hour >= 18 || hour < 6) ? 'dark' : 'light';
    }
    return 'light';
  });

  const isTAM = session?.user?.email === 'toyotaastra@kmdi.co.id';
  const isAdmin = session?.user?.email === 'kmdimcc@gmail.com';

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('theme-transition');
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('theme', theme);
    setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 500);
  }, [theme]);

  const loadDrivers = useCallback(async () => {
    setIsDriversLoading(true);
    try {
      let data = await fetchActiveDrivers(selectedDate, selectedArea, selectedShift);

      // Jika shift aktif kosong, coba shift alternatif (umum di NGORO: data Night tapi filter Day)
      if (data.length === 0) {
        const altShift = selectedShift === 'Day' ? 'Night' : 'Day';
        const altData = await fetchActiveDrivers(selectedDate, selectedArea, altShift);
        if (altData.length > 0) {
          data = altData;
          setSelectedShift(altShift);
        }
      }

      setDrivers(data);

      if (data.length > 0) {
        const stillInList = data.find(d => d.id === selectedDriverId);
        if (!stillInList) setSelectedDriverId(data[0].id);
      } else {
        setSelectedDriverId('');
        setSelectedDriver(undefined);
        setRitases([]);
      }
    } catch (error) {
      console.error('Error loading drivers in App:', error);
      setDrivers([]);
      setSelectedDriverId('');
      setSelectedDriver(undefined);
      setRitases([]);
    }
    setIsDriversLoading(false);
  }, [selectedDate, selectedArea, selectedShift, selectedDriverId]);

  useEffect(() => {
    loadDrivers();
  }, [selectedDate, selectedArea, selectedShift]);

  const loadData = useCallback(async () => {
    if (!selectedDriverId) return;
    setIsLoading(true);
    try {
      const data = await fetchDashboardData(selectedDate, selectedDriverId, selectedArea);
      if (data) {
        setRitases(data.ritases || []);
        if (data.driverDetails) setSelectedDriver(data.driverDetails);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, [selectedDate, selectedDriverId, selectedArea]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadData();
        loadDrivers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        loadData();
        loadDrivers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leadtimes' }, () => {
        // LeadTimePage handles its own fetching, but we could trigger global refresh if needed
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData, loadDrivers]);

  // Auth Effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-500/25 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-red-500/25 border-t-red-500 rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="*" element={<LoginPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
    localStorage.setItem('manual-theme-set', 'true');
  };

  const sidebarWidth = isSidebarCollapsed ? 'md:ml-[100px]' : 'md:ml-[284px]';



  return (
    <NotificationProvider>
      <BrowserRouter>
        <div
          data-theme={theme}
          className={`flex min-h-screen bg-(--bg-app) text-(--text-main) transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}
        >
        {/* Ambient aurora background */}
        <div className="aurora-bg" aria-hidden="true" />

        <Sidebar
          drivers={drivers}
          selectedDriverId={selectedDriverId}
          onDriverSelect={setSelectedDriverId}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(c => !c)}
          isLoading={isDriversLoading}
          theme={theme}
          selectedShift={selectedShift}
          onShiftChange={setSelectedShift}
          selectedArea={selectedArea}
          isTAM={isTAM}
          isAdmin={isAdmin}
        />

        <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarWidth} overflow-x-hidden`}>
          <Navbar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                selectedShift={selectedShift}
                onShiftChange={setSelectedShift}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(o => !o)}
                isSidebarCollapsed={isSidebarCollapsed}
                theme={theme}
                onThemeToggle={toggleTheme}
                session={session}
                isTAM={isTAM}
                isAdmin={isAdmin}
              />

              <main id="pdf-export-content" className="pt-24 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
                  <Suspense fallback={<LoadingScreen />}>
                    <AnimatedRoutes 
                      isLoading={isLoading}
                      selectedDriver={selectedDriver}
                      selectedDate={selectedDate}
                      setSelectedDate={setSelectedDate}
                      selectedArea={selectedArea}
                      setSelectedArea={setSelectedArea}
                      isTAM={isTAM}
                      ritases={ritases}
                      isAdmin={isAdmin}
                    />
                  </Suspense>
                </div>
              </main>
              <Footer />
            </div>
        <SpeedInsights />
      </div>
        <DelayNotificationStack />
     </BrowserRouter>
    </NotificationProvider>
  );
}

interface AnimatedRoutesProps {
  isLoading: boolean;
  selectedDriver: any;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  selectedArea: string;
  setSelectedArea: (a: string) => void;
  isTAM: boolean;
  ritases: any[];
  isAdmin: boolean;
}

const AnimatedRoutes = ({
  isLoading,
  selectedDriver,
  selectedDate,
  setSelectedDate,
  selectedArea,
  setSelectedArea,
  isTAM,
  ritases,
  isAdmin
}: AnimatedRoutesProps) => {
  const location = useLocation();
  const pathname = location.pathname;
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());

  // Render the routes element
  const element = (
    <Routes location={location}>
      <Route path="/" element={
        <AnimatePresence mode="wait">
          {isLoading && !selectedDriver ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 animate-pulse"
            >
              <div className="h-48 bg-white/50 dark:bg-white/[0.04] rounded-4xl border border-slate-200/40 dark:border-white/[0.06]" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 h-96 bg-white/50 dark:bg-white/[0.04] rounded-4xl border border-slate-200/40 dark:border-white/[0.06]" />
                <div className="h-96 bg-white/50 dark:bg-white/[0.04] rounded-4xl border border-slate-200/40 dark:border-white/[0.06]" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Header
                driver={selectedDriver as any}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                selectedArea={selectedArea}
                onAreaChange={setSelectedArea}
                isTAM={isTAM}
              />
              <div className="mt-6">
                <RitaseTracking
                  selectedDate={selectedDate}
                  ritases={ritases}
                  isLoading={isLoading}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      } />
      <Route path="/dashboard" element={<DashboardPage isTAM={isTAM} />} />
      <Route path="/monitoring" element={<FleetMonitoringPage isTAM={isTAM} />} />
      <Route path="/leadtime" element={<LeadTimePage isTAM={isTAM} />} />
      <Route path="/route-analytics" element={<RouteAnalyticsPage isTAM={isTAM} />} />
      <Route path="/standar-leadtime" element={<StandarLeadtimePage />} />
      <Route path="/eco" element={<EcoDrivingPage isTAM={isTAM} />} />
      <Route path="/carbon" element={<CarbonNeutralPage />} />
      <Route path="/tenko" element={<TenkoPage isTAM={isTAM} />} />
      <Route path="/driver-analytics" element={<DriverAnalyticsPage isTAM={isTAM} />} />
      
      <Route path="/drivers" element={<DriversPage />} />
      <Route path="/drivers/:id" element={<DriverDetailPage />} />
      <Route path="/training" element={<TrainingDashboardPage />} />
      <Route path="/kr-schedule" element={<KRDashboardPage />} />
      <Route path="/admin-drivers" element={isAdmin ? <AdminDriversPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  cacheRef.current.set(pathname, element);

  // Batasi cache agar tidak membengkak
  if (cacheRef.current.size > 8) {
    const oldest = cacheRef.current.keys().next().value;
    if (oldest) cacheRef.current.delete(oldest);
  }

  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([key, item]) => (
        <motion.div
          key={key}
          initial={key === pathname ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={key !== pathname ? 'hidden' : ''}
        >
          {item}
        </motion.div>
      ))}
    </>
  );
};
