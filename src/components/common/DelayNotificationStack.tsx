import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export default function DelayNotificationStack() {
  const { toasts, dismissToast, clearAllToasts } = useNotifications();
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toasts.length === 0) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (stackRef.current && !stackRef.current.contains(target)) {
        clearAllToasts();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [toasts.length, clearAllToasts]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div ref={stackRef} className="fixed top-5 right-5 z-[100] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-2rem)]">
      {toasts.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            {toasts.length} Notifikasi
          </span>
          <button
            onClick={clearAllToasts}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        </div>
      )}
      <AnimatePresence>
        {toasts.map(n => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-white dark:bg-slate-900 shadow-2xl shadow-rose-500/20"
          >
            <div className="h-1 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300" />
            <div className="flex items-start gap-3 p-4">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Berpotensi Delay</p>
                <p className="text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">{n.driverName}</p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {n.nopol} · Rit {n.ritase}{n.area ? ` · ${n.area}` : ''} · {n.time}
                </p>
              </div>
              <button
                onClick={() => dismissToast(n.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 shrink-0 transition-colors"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
