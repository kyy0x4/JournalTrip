import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGE_META, LANGUAGES } from '../../i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEscapeKey(() => setOpen(false), open);

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(o => !o)}
        className={`relative p-2.5 rounded-xl transition-all shadow-sm outline-none ring-0 ${
          open
            ? 'bg-red-600 text-white shadow-red-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title={t('common.language')}
        aria-label={t('common.language')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Languages className="w-4 h-4" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 min-w-[200px] origin-top-right"
            role="menu"
          >
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-2xl overflow-hidden p-1.5">
              {LANGUAGES.map(code => {
                const meta = LANGUAGE_META[code];
                const active = code === language;
                return (
                  <button
                    key={code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => { setLanguage(code); setOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                      active
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="text-base leading-none shrink-0">{meta.flag}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-black uppercase tracking-wider truncate">{meta.native}</span>
                      <span className={`block text-[9px] font-bold leading-tight truncate ${active ? 'text-red-500/70' : 'text-slate-400 dark:text-slate-500'}`}>
                        {meta.name}
                      </span>
                    </span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
