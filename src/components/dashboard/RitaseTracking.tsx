import { useState } from 'react';
import { Route } from 'lucide-react';
import { motion } from 'motion/react';
import { Ritase } from '../../types';
import { RITASE_DATA } from '../../constants';
import RitaseItem from './RitaseItem';

interface RitaseTrackingProps {
  selectedDate: string;
  ritases: Ritase[];
  isLoading: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function RitaseTracking({ selectedDate, ritases, isLoading }: RitaseTrackingProps) {
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  // Auto-expand active ritase when data loads
  useState(() => {
    const active = ritases.find(r => r.type === 'active');
    if (active && !expandedIds.includes(active.id)) {
      setExpandedIds(prev => [...prev, active.id]);
    }
  });

  const toggleRitase = (id: number) => {
    setExpandedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  return (
    <section className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl claude-gradient flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(217,119,87,0.5)]">
            <Route className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Ritase Tracking</h3>
        </div>
        <span className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200/50 dark:border-white/[0.08] italic w-fit">
          Data: {new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6 glass-card p-3 rounded-xl">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2">Legend:</p>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Selesai</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(217,119,87,0.7)]" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Perjalanan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Menunggu</span>
        </div>
      </div>

      {isLoading && ritases.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center gap-3"
        >
          <div className="w-8 h-8 border-4 border-red-500/25 border-t-red-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Loading Data...</p>
        </motion.div>
      ) : ritases.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-2xl p-8 text-center"
        >
          <p className="text-slate-400 dark:text-slate-500 font-medium">Tidak ada data ritase untuk tanggal dan driver ini.</p>
        </motion.div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {ritases.map((ritase: Ritase) => (
            <RitaseItem 
              key={ritase.id} 
              ritase={ritase} 
              isExpanded={expandedIds.includes(ritase.id)}
              onToggle={() => toggleRitase(ritase.id)}
            />
          ))}
        </motion.div>
      )}
    </section>
  );
}
