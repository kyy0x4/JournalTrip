import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Lock, MapPin, Truck, CheckCircle2, Clock } from 'lucide-react';
import { Ritase } from '../../types';

interface RitaseItemProps {
  ritase: Ritase;
  isExpanded: boolean;
  onToggle: () => void;
}

const timelineContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const timelineItemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 }
};

const RitaseItem: React.FC<RitaseItemProps> = ({ ritase, isExpanded, onToggle }) => {
  const isLocked = ritase.type === 'locked';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={isLocked ? {} : { scale: 1.01 }}
      className="relative"
    >
      <motion.button 
        whileTap={isLocked ? {} : { scale: 0.98 }}
        onClick={() => !isLocked && onToggle()}
        className={`w-full text-left glass-card glass-hover rounded-2xl p-4 md:p-5 relative z-20 overflow-hidden outline-none ${
          isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
        } ${isExpanded ? 'shadow-lg shadow-red-500/10 dark:shadow-red-500/5 border-red-500/25' : ''}`}
      >
        {ritase.type === 'active' && (
          <motion.div
            layoutId={`activebar-${ritase.id}`}
            className="absolute top-0 left-0 w-1.5 h-full claude-gradient shadow-[2px_0_12px_rgba(217,119,87,0.5)]"
          />
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shadow-md ring-1 ${
              ritase.status === 'finished' ? 'bg-emerald-500 text-white ring-emerald-500/30 shadow-emerald-500/30' :
              ritase.status === 'active' ? 'claude-gradient text-white ring-red-500/30 shadow-red-500/30' :
              'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ring-slate-200/50 dark:ring-slate-700'
            }`}>
              <Truck className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="overflow-hidden">
              <p className={`text-xs md:text-sm font-bold truncate ${ritase.type === 'active' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>Ritase {ritase.ritaseNo}</p>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{ritase.route}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <span className={`flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold px-2.5 md:px-3 py-1 rounded-full uppercase border backdrop-blur-sm ${
              ritase.status === 'finished' ? 'text-emerald-600 bg-emerald-50/70 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
              ritase.status === 'active' ? 'text-red-600 bg-red-50/70 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20 shadow-[0_0_12px_rgba(217,119,87,0.25)]' :
              'text-slate-400 bg-slate-100/70 border-slate-200 dark:text-slate-500 dark:bg-slate-800 dark:border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                ritase.status === 'active' ? 'bg-red-500 animate-pulse' : ritase.status === 'finished' ? 'bg-emerald-500' : 'bg-slate-400'
              }`} />
              {ritase.status}
            </span>
            {isLocked ? (
              <Lock className="w-4 h-4 text-slate-300 dark:text-slate-700" />
            ) : (
              <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </motion.span>
            )}
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {isExpanded && ritase.timeline && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden glass-card rounded-b-2xl -mt-4 mx-2 md:mx-4 pt-8 pb-6 px-4 md:px-6 shadow-xl shadow-slate-200/50 dark:shadow-black/40 relative z-10"
          >
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-lg w-fit border dark:border-rose-900/30">
                  <MapPin className="w-4 h-4" />
                  <span className="text-[10px] md:text-xs font-bold tracking-tight">Rute: {ritase.route}</span>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-1">TOTAL DURASI</p>
                  <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{ritase.duration}</p>
                </div>
              </div>

              {/* Responsive Timeline Visualization */}
              <motion.div 
                variants={timelineContainerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col md:flex-row justify-between items-start md:items-center relative gap-6 md:gap-0 pl-4 md:pl-0"
              >
                {/* Background Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-4.5 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 z-0" />
                {/* Active/Completed Progress Line (Desktop) */}
                {(ritase.type === 'active' || ritase.type === 'completed') && (
                  <div className={`hidden md:block absolute top-4.5 left-0 h-0.5 z-0 ${
                    ritase.type === 'active' ? 'bg-red-600 dark:bg-red-500' : 'bg-green-500'
                  }`} style={{ 
                    width: ritase.type === 'completed' 
                      ? '100%' 
                    : `${((ritase.timeline?.filter(s => s.type === 'completed' || s.type === 'active').length || 1) - 0.5) / (ritase.timeline?.length || 1) * 100}%` 
                  }} />
                )}


                {/* Vertical Connecting Line (Mobile) */}
                <div className="md:hidden absolute top-0 left-4.5 w-0.5 h-full bg-slate-100 dark:bg-slate-800 z-0" />

                {ritase.timeline.map((step, idx) => (
                  <motion.div 
                    key={idx} 
                    variants={timelineItemVariants}
                    className={`flex md:flex-col items-center md:items-center relative z-10 w-full md:w-32 gap-4 md:gap-0 ${step.type === 'pending' ? 'opacity-40' : ''}`}
                  >
                    <div className="md:mb-3 shrink-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md transition-all hover:scale-110 ${
                        step.type === 'active' ? 'bg-red-600 dark:bg-red-500' :
                        (ritase.type === 'completed' || step.type === 'completed' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700')
                      }`}>
                        {step.type === 'active' ? (
                          <Truck className="w-4 h-4 text-white" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-left md:text-center">
                      <p className={`text-[9px] font-black tracking-wider ${step.type === 'active' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500 uppercase tracking-widest'}`}>{step.label}</p>
                      <div className="flex items-center md:justify-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 font-mono">{step.plan}</span>
                      </div>
                      <div className="flex items-center md:justify-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${step.delay && ritase.type !== 'completed' ? 'bg-rose-500 animate-pulse' : (ritase.type === 'completed' || step.type === 'completed' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700')}`} />
                        <span className={`text-[10px] font-bold font-mono ${step.delay && ritase.type !== 'completed' ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                          {step.actual}
                        </span>
                        {step.delay && ritase.type !== 'completed' && <span className="text-[8px] font-black text-rose-500 dark:text-rose-400">{step.delay}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RitaseItem;
