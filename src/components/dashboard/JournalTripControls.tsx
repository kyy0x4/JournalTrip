import { useRef, useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  Calendar as CalendarIcon, Sun, Moon, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface JournalTripControlsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedShift: 'Day' | 'Night';
  onShiftChange: (shift: 'Day' | 'Night') => void;
  compact?: boolean;
}

export default function JournalTripControls({
  selectedDate,
  onDateChange,
  selectedShift,
  onShiftChange,
  compact = false,
}: JournalTripControlsProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const shiftRef = useRef<HTMLDivElement>(null);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const isDay = selectedShift === 'Day';

  useEscapeKey(() => setIsShiftOpen(false), !!isShiftOpen);

  return (
    <div className="flex items-center gap-2 md:gap-3">
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
          onClick={() => setIsShiftOpen(o => !o)}
          className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-all outline-none focus:outline-none focus:ring-0 font-black text-[10px] ${
            isDay
              ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-300'
              : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300'
          }`}
        >
          <motion.span key={selectedShift} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
            {isDay ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </motion.span>
          {!compact && <span>{selectedShift} Shift</span>}
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
    </div>
  );
}
