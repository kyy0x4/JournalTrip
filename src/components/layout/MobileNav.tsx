import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, X } from 'lucide-react';
import { NavGroup } from '../../constants/navigation';
import Logo from '../../image/Logo.png';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
}

export default function MobileNav({ open, onClose, groups }: MobileNavProps) {
  const location = useLocation();
  const [expanded, setExpanded] = useState<string | null>(null);

  const isItemActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const isGroupActive = (group: NavGroup) => group.items.some(item => isItemActive(item.path));

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed top-0 bottom-0 left-0 w-[300px] max-w-[85vw] z-[70] lg:hidden bg-white dark:bg-[#1c1815] border-r border-slate-200/60 dark:border-white/[0.06] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200/40 dark:border-white/[0.06]">
              <img src={Logo} alt="KMDI" className="h-7 object-contain" />
              <button
                onClick={onClose}
                className="ml-auto p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Groups */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {groups.map(group => {
                const groupActive = isGroupActive(group);
                const isOpen = expanded === group.id;
                const Icon = group.icon;
                return (
                  <div key={group.id} className="rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : group.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors
                        ${isOpen || groupActive
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'}
                      `}
                    >
                      <Icon className="w-4.5 h-4.5 shrink-0" />
                      <span className="text-sm font-bold flex-1 text-left">{group.label}</span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        <ChevronDown className="w-4 h-4 opacity-60" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="pl-3 pr-1 py-1 space-y-0.5">
                            {group.items.map(item => {
                              const active = isItemActive(item.path);
                              const ItemIcon = item.icon;
                              return (
                                <Link
                                  key={item.id}
                                  to={item.path}
                                  onClick={onClose}
                                  className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
                                    ${active
                                      ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'}
                                  `}
                                >
                                  <ItemIcon className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
                                  <span className="flex-1 text-left min-w-0">
                                    <span className="block text-xs font-bold leading-tight truncate">{item.label}</span>
                                    <span className={`block text-[9px] font-semibold leading-tight truncate ${active ? 'text-red-500/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                      {item.sub}
                                    </span>
                                  </span>
                                  {active && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200/40 dark:border-white/[0.06] shrink-0">
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                KMDI <span className="text-red-500">·</span> Fleet Monitoring
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
