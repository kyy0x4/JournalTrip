import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, AlertTriangle, X, Trash2, Inbox } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell() {
  const { history, unreadCount, markAllSeen, clearHistory } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markAllSeen();
  };

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        className={`relative p-2.5 rounded-xl transition-all shadow-sm outline-none ring-0 ${
          open
            ? 'bg-rose-600 text-white shadow-rose-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="Riwayat Notifikasi"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 rounded-full bg-rose-500 text-white text-[8px] font-black shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 origin-top-right"
          >
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Riwayat Notifikasi
                </p>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-500 text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto scrollbar-hide">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Inbox className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada notifikasi</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1">Armada berpotensi delay akan muncul di sini</p>
                  </div>
                ) : (
                  history.map(n => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{n.driverName}</p>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          {n.nopol} · Rit {n.ritase}{n.area ? ` · ${n.area}` : ''}
                        </p>
                        <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-0.5">
                          Berpotensi Delay
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] font-bold text-slate-400 tabular-nums">
                        {new Date(n.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} · {n.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
