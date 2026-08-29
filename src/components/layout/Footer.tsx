import { motion } from 'framer-motion';
import { ShieldCheck, Heart, Code2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full mt-auto py-6 px-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left Side: Brand/Tool Name */}
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-red-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            Internal Monitoring Tool
          </span>
        </div>

        {/* Right Side: Maintainer Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 group cursor-default"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full border border-slate-200/50 dark:border-slate-700/50 transition-all group-hover:border-red-500/30 group-hover:bg-red-50/30 dark:group-hover:bg-red-500/5">
            <Code2 className="w-3 h-3 text-slate-400 group-hover:text-red-500 transition-colors" />
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors uppercase tracking-wider">
              Developed &amp; Maintained by <span className="text-red-600 dark:text-red-400 font-black">KMDI (MCC Team)</span>
            </span>
          </div>
          
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500">
            <Heart className="w-3 h-3 fill-current animate-pulse" />
          </div>
        </motion.div>

      </div>
    </footer>
  );
}
