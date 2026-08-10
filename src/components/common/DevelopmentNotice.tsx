import { Construction } from 'lucide-react';

export default function DevelopmentNotice({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/30 rounded-2xl px-4 py-3">
      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
        <Construction className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Dalam Pengembangan</p>
        <p className="text-[10px] font-semibold text-amber-600/80 dark:text-amber-400/70">
          {message || 'Halaman ini masih dalam tahap pengembangan. Data & fitur dapat berubah sewaktu-waktu.'}
        </p>
      </div>
    </div>
  );
}
