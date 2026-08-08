import { motion } from 'motion/react';

export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-10 h-10 border-4 border-red-500/25 border-t-red-500 rounded-full animate-spin" />
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
        >
          Memuat...
        </motion.p>
      </motion.div>
    </div>
  );
}
