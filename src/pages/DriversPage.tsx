import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Search, 
  Filter, 
  ChevronRight, 
  Shield, 
  AlertTriangle,
  UserPlus,
  Truck
} from 'lucide-react';
import { fetchAllDrivers } from '../services/dataFetcher';
import { Driver } from '../types';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await fetchAllDrivers();
      setDrivers(data);
      setIsLoading(false);
    }
    load();
  }, []);

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.noPolisi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.nik?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Data Driver
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-3 py-1 rounded-full border dark:border-red-900/50">
              {drivers.length} TOTAL
            </span>
          </h1>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">Manajemen Data & Dokumen Pengemudi</p>
        </div>
      </div>

      {/* ── FILTERS & SEARCH ── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-red-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari nama, NIK, atau no polisi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold focus:outline-none shadow-sm dark:text-white outline-none ring-0"
          />
        </div>
      </div>

      {/* ── DRIVERS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {isLoading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-4xl p-6 shadow-sm space-y-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                  <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl" />
                <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl" />
              </div>
            </div>
          ))
        ) : filteredDrivers.map((driver) => (
          <Link 
            key={driver.id} 
            to={`/drivers/${driver.name.replace(/\s+/g, '-')}`}
            state={{ driver }}
            className="group bg-white dark:bg-slate-900 rounded-4xl p-6 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 shadow-sm relative overflow-hidden outline-none ring-0"
          >
            {/* Hover Background Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-red-500/5 to-transparent rounded-bl-full translate-x-8 -translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500" />
            
            <div className="flex items-center gap-4 mb-6">
              {driver.avatar ? (
                <img src={driver.avatar} alt={driver.name} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-red-100 dark:group-hover:ring-red-900/50 transition-all" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 dark:text-white truncate group-hover:text-red-600 transition-colors">{driver.name}</h3>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{driver.nik || 'NO NIK'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Unit</span>
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">{driver.noPolisi || '---'}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className={`w-3.5 h-3.5 ${driver.simStatus === 'Valid' ? 'text-green-500' : 'text-rose-500'}`} />
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">SIM Status</span>
                </div>
                <span className={`text-[10px] font-black uppercase ${
                  driver.simStatus === 'Valid' ? 'text-green-600 dark:text-green-400' : 'text-rose-500'
                }`}>
                  {driver.simStatus || '--'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs font-black tracking-widest text-red-600 dark:text-red-400 group-hover:gap-2 transition-all">
              VIEW PROFILE
              <ChevronRight className="w-4 h-4 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      {filteredDrivers.length === 0 && !isLoading && (
        <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-4xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">No drivers found matching your search</p>
        </div>
      )}
    </div>
  );
}
