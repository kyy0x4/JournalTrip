import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, Search, Calendar, CheckCircle2, 
  XCircle, ChevronRight, Save, ArrowLeft,
  X, Check, User, AlertCircle
} from 'lucide-react';
import { fetchActiveDrivers } from '../services/dataFetcher';
import { Driver, P2HRecord } from '../types';
import { supabase } from '../lib/supabase';
import { fetchP2HToday, saveP2H } from '../services/p2hService';
import AuthModal from '../components/auth/AuthModal';
import { P2H_CATEGORIES } from '../constants/p2hItems';

export default function P2HPage() {
  const [selectedDate, setSelectedDate] = useState(() => 
    new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  );
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [p2hRecords, setP2HRecords] = useState<Record<string, P2HRecord>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [checklistState, setChecklistState] = useState<Record<string, 'OK' | 'NG'>>({});
  const [catatan, setCatatan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

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

  const loadData = async () => {
    setLoading(true);
    try {
      const activeDrivers = await fetchActiveDrivers(selectedDate, 'ALL');
      setDrivers(activeDrivers);
      const p2hMap = await fetchP2HToday(selectedDate);
      setP2HRecords(p2hMap);
    } catch (e) {
      console.error('Error loading P2H data:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleDriverSelect = (driver: Driver) => {
    executeWithAuth(() => {
      setSelectedDriver(driver);
      const record = p2hRecords[driver.id];
      if (record && record.checklist) {
        setChecklistState(record.checklist);
        setCatatan(record.catatan || '');
      } else {
        // Initialize all to OK by default? Or empty?
        // Usually it's better to force them to click, but for 40+ items maybe default to OK is faster,
        // let's leave it empty so they have to fill it? 
        // We'll set it empty, they must check everything.
        const defaultState: Record<string, 'OK'|'NG'> = {};
        setChecklistState(defaultState);
        setCatatan('');
      }
    });
  };

  const handleToggleItem = (itemId: string, status: 'OK' | 'NG') => {
    setChecklistState(prev => ({
      ...prev,
      [itemId]: status
    }));
  };

  const setAllCategoryOK = (categoryId: string) => {
    const category = P2H_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      const newState = { ...checklistState };
      category.items.forEach(item => {
        newState[item.id] = 'OK';
      });
      setChecklistState(newState);
    }
  };

  const handleSave = async () => {
    if (!selectedDriver) return;
    
    // Check if all items are filled
    const totalItems = P2H_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);
    const filledItems = Object.keys(checklistState).length;
    
    if (filledItems < totalItems) {
      showToast(`Harap lengkapi semua checklist! (Terisi ${filledItems}/${totalItems})`);
      return;
    }

    setIsSaving(true);
    
    // Determine overall status. If any is NG, then overall is NG.
    const hasNG = Object.values(checklistState).includes('NG');
    const overallStatus: 'OK' | 'NG' = hasNG ? 'NG' : 'OK';

    try {
      const userRes = await supabase.auth.getUser();
      const userEmail = userRes.data.user?.email || 'Unknown Checker';
      
      const newRecord = {
        tanggal: selectedDate,
        driver_id: selectedDriver.id,
        nopol: selectedDriver.noPolisi || '--',
        checked_by: userEmail,
        status: overallStatus,
        catatan: catatan,
        checklist: checklistState
      };
      
      const res = await saveP2H(newRecord);
      if (res.success) {
        setP2HRecords(prev => ({ ...prev, [selectedDriver.id]: res.data! }));
        setSelectedDriver(null);
        showToast('Data berhasil disimpan!', 'success');
      } else {
        showToast('Gagal menyimpan data, pastikan tabel p2h di Supabase sudah ada kolom jsonb checklist');
      }
    } catch (e) {
      console.error(e);
      showToast('Error saving P2H');
    }
    
    setIsSaving(false);
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (d.noPolisi && d.noPolisi.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 relative">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleAuthSuccess} />
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'error' 
                ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30'
                : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="font-bold text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedDriver ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200/50 dark:border-slate-800 shadow-sm">
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Input P2H</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Pemeriksaan dan Pengecekan Harian Armada</p>
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari Driver / Nopol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all font-semibold"
                />
              </div>

              <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all font-black text-slate-700 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-slate-500 animate-pulse font-bold">Memuat data driver...</div>
            ) : filteredDrivers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-bold">Tidak ada jadwal pengiriman / driver aktif hari ini.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDrivers.map(driver => {
                  const record = p2hRecords[driver.id];
                  return (
                    <div 
                      key={driver.id} 
                      onClick={() => handleDriverSelect(driver)}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        {driver.avatar ? (
                          <img src={driver.avatar} alt="" className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <User className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-black text-slate-800 dark:text-white group-hover:text-red-600 transition-colors">{driver.name}</p>
                          <p className="text-xs font-bold text-slate-500">{driver.noPolisi || 'No Plat'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {record ? (
                          <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                            record.status === 'OK' 
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                          }`}>
                            {record.status === 'OK' ? 'SIAP OPERASIONAL' : 'TIDAK SIAP'}
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                            BELUM ISI
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800 overflow-hidden shadow-2xl"
        >
          {/* Header Form */}
          <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedDriver(null)}
                className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase">Checklist P2H</h2>
                <p className="text-xs font-bold text-slate-500">{selectedDriver.name} • {selectedDriver.noPolisi}</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedDate}</p>
            </div>
          </div>

          <div className="p-4 sm:p-8 space-y-8">
            {P2H_CATEGORIES.map((category) => {
              const allOK = category.items.every(item => checklistState[item.id] === 'OK');
              return (
                <div key={category.id} className="bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl p-1 sm:p-2 border border-slate-100 dark:border-slate-800/50">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 dark:text-slate-200 text-sm">{category.title}</h3>
                    {!allOK && (
                      <button 
                        onClick={() => setAllCategoryOK(category.id)}
                        className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        Set Semua OK
                      </button>
                    )}
                  </div>
                  
                  <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
                    {category.items.map((item) => (
                      <div key={item.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                            {item.id}. {item.item}
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium italic">
                            Syarat: {item.syarat}
                          </p>
                        </div>
                        
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => handleToggleItem(item.id, 'OK')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                              checklistState[item.id] === 'OK'
                                ? 'bg-emerald-500 text-white shadow-md'
                                : 'text-slate-500 hover:text-emerald-600'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> OK
                          </button>
                          <button
                            onClick={() => handleToggleItem(item.id, 'NG')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                              checklistState[item.id] === 'NG'
                                ? 'bg-red-500 text-white shadow-md'
                                : 'text-slate-500 hover:text-red-600'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" /> NG
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Catatan Area */}
            <div className="px-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Temuan / Catatan Khusus
              </label>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Tulis jika ada temuan NG..."
                rows={3}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all font-semibold resize-none"
              />
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-wider transition-all active:scale-95 shadow-xl shadow-red-600/20 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Simpan Checklist
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
