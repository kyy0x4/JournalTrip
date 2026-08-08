import { useState, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { Timer, Map, MapPin, Navigation, Route as RouteIcon, Clock, ChevronLeft, ChevronRight, Leaf, Zap, AlertTriangle, TrendingDown, RotateCcw, ParkingCircle, Wind, Ship } from 'lucide-react';

const ROWS_PER_PAGE = 6;

type RouteRow = {
  no: number;
  from: string;
  to: string;
  lt: string;
  rest?: string;
};

type RouteFooter = {
  label: string;
  lt?: string;
  rest?: string;
};

type Route = {
  id: string;
  title: string;
  icon: ReactElement;
  color: string;
  hasRest: boolean;
  columns: string[];
  data: RouteRow[];
  footer?: RouteFooter[];
};

const routes: Route[] = [
  {
    id: 'palembang',
    title: 'Palembang - Padang',
    icon: <Map className="w-4 h-4" />,
    color: 'emerald',
    hasRest: true,
    columns: ['No', 'From', 'To', 'Standar LT', 'Istirahat'],
    data: [
      { no: 1, from: 'RVDC Poligon', to: 'Sungai Lilin', lt: '6 Jam', rest: '5 Jam' },
      { no: 2, from: 'Sungai Lilin', to: 'Muara Tebo', lt: '7 Jam', rest: '6 Jam' },
      { no: 3, from: 'Muara Tebo', to: 'Muara Bungo', lt: '5 Jam', rest: '5 Jam' },
      { no: 4, from: 'Muara Bungo', to: 'Sijunjung', lt: '6 Jam', rest: '5 Jam' },
      { no: 5, from: 'Sijunjung', to: 'RP. Padang', lt: '5 Jam', rest: '-' },
    ],

  },
  {
    id: 'jawa',
    title: 'JBK / Karawang - Ngoro',
    icon: <RouteIcon className="w-4 h-4" />,
    color: 'blue',
    hasRest: false,
    columns: ['No', 'From', 'To', 'Standar LT'],
    data: [
      { no: 1, from: 'Pool Karawang', to: 'NVDC Karawang', lt: '30 Menit' },
      { no: 2, from: 'Pool Karawang', to: 'NVDC Cibitung', lt: '1j 30m' },
      { no: 3, from: 'Pool Karawang', to: 'NVDC Sunter, Priok', lt: '3 Jam' },
      { no: 4, from: 'Pool Karawang', to: 'Patimban', lt: '4 Jam' },
      { no: 5, from: 'Pool Karawang', to: 'EKY', lt: '1 Jam' },
      { no: 6, from: 'EKY', to: 'IKT', lt: '3 Jam' },
      { no: 7, from: 'NVDC Cibitung', to: 'Rest Area 166', lt: '5 Jam' },
      { no: 8, from: 'NVDC Karawang', to: 'Rest Area 166', lt: '4 Jam' },
      { no: 9, from: 'NVDC Sunter', to: 'Rest Area 166', lt: '6 Jam' },
      { no: 10, from: 'Rest Area 166', to: 'Rest Area 379', lt: '6 Jam' },
      { no: 11, from: 'Rest Area 379', to: 'Rest Area 575A', lt: '6 Jam' },
      { no: 12, from: 'Rest Area 575A', to: 'RVDC Ngoro', lt: '3 Jam' },
      { no: 13, from: 'RVDC Ngoro', to: 'Pool Karawang', lt: '24 Jam' },
      { no: 14, from: 'EKY', to: 'PLANT 3', lt: '1 Jam' },
    ],
  },
  {
    id: 'kalimantan',
    title: 'Rute Kalimantan',
    icon: <MapPin className="w-4 h-4" />,
    color: 'amber',
    hasRest: false,
    columns: ['No', 'From', 'To', 'Standar LT'],
    data: [
      { no: 1, from: 'Balikpapan', to: 'Samarinda', lt: '5 Jam' },
      { no: 2, from: 'Balikpapan', to: 'Tenggarong', lt: '8 Jam' },
      { no: 3, from: 'Balikpapan', to: 'Bontang', lt: '10 Jam' },
      { no: 4, from: 'Balikpapan', to: 'Sangatta', lt: '12 Jam' },
      { no: 5, from: 'Balikpapan', to: 'KM 38', lt: '3 Jam' },
      { no: 6, from: 'KM 38', to: 'Ring Road Samarinda', lt: '4 Jam' },
      { no: 7, from: 'Ring Road Samarinda', to: 'Gunung Menangis', lt: '4 Jam' },
      { no: 8, from: 'Gunung Menangis', to: 'Sangatta', lt: '2 Jam' },
    ],
  },
  {
    id: 'sulawesi',
    title: 'Rute Sulawesi',
    icon: <Navigation className="w-4 h-4" />,
    color: 'purple',
    hasRest: false,
    columns: ['No', 'From', 'To', 'Standar LT'],
    data: [
      { no: 1, from: 'Pool Makassar', to: 'Port Makassar', lt: '1 Jam' },
      { no: 2, from: 'Port Makassar', to: 'Poros Pinrang', lt: '4 Jam' },
      { no: 3, from: 'Poros Pinrang', to: 'Majene', lt: '5 Jam' },
      { no: 4, from: 'Majene', to: 'Mamuju', lt: '4 Jam' },
      { no: 5, from: 'Mamuju', to: 'Karosa', lt: '4 Jam' },
      { no: 6, from: 'Karosa', to: 'Sarjo', lt: '5 Jam' },
      { no: 7, from: 'Sarjo', to: 'Kebon Kopi', lt: '5 Jam' },
      { no: 8, from: 'Kebon Kopi', to: 'Kasimbar', lt: '5 Jam' },
      { no: 9, from: 'Kasimbar', to: 'Santigi', lt: '5 Jam' },
      { no: 10, from: 'Santigi', to: 'Paguat', lt: '5 Jam' },
      { no: 11, from: 'Paguat', to: 'Hasjrat Gorontalo', lt: '5 Jam' },
    ],
  },
  {
    id: 'sumatera',
    title: 'Rute Sumatera (Delivery)',
    icon: <Ship className="w-4 h-4" />,
    color: 'indigo',
    hasRest: false,
    columns: ['No', 'Tujuan', 'Standar LT'],
    data: [
      { no: 1, from: 'Palembang', to: '', lt: '36 Jam' },
      { no: 2, from: 'Lampung', to: '', lt: '24 Jam' },
      { no: 3, from: 'Pekanbaru', to: '', lt: '72 Jam' },
    ],
    footer: [
      { label: 'Termasuk waktu penyeberangan ferry Merak–Bakauheni' },
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; pill: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', pill: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-500/30',    pill: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-600 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-500/30',  pill: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  purple:  { bg: 'bg-purple-50 dark:bg-purple-500/10',text: 'text-purple-600 dark:text-purple-400',border: 'border-purple-200 dark:border-purple-500/30',pill: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-500/10',text: 'text-indigo-600 dark:text-indigo-400',border: 'border-indigo-200 dark:border-indigo-500/30',pill: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' },
};

function RouteCard({ route, delay }: { route: Route; delay: number }) {
  const [page, setPage] = useState(1);
  const c = colorMap[route.color];
  const totalPages = Math.ceil(route.data.length / ROWS_PER_PAGE);
  const paged = route.data.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const isLastPage = page === totalPages;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col"
    >
      {/* Card Header */}
      <div className={`px-5 py-4 border-b ${c.border} flex items-center gap-3 ${c.bg}`}>
        <div className={`p-2.5 rounded-xl border ${c.border} bg-white/60 dark:bg-slate-900/40`}>
          <span className={c.text}>{route.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-[11px] sm:text-sm font-black uppercase tracking-tight truncate ${c.text}`}>{route.title}</h3>
          <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">{route.data.length} titik perjalanan</p>
        </div>
        {totalPages > 1 && (
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${c.pill}`}>
            {page}/{totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[340px]">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/40">
              {route.columns.map((col, i) => (
                <th key={col} className={`px-3 sm:px-4 py-3 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 ${i === 0 ? 'w-10 text-center' : ''}`}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {paged.map((row) => (
              <tr key={row.no} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-3 sm:px-4 py-3 text-[9px] font-bold text-slate-400 text-center">{row.no}</td>
                <td className={`px-3 sm:px-4 py-3 text-[9px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase ${!row.to ? 'font-black text-slate-900 dark:text-white' : ''}`}>{row.from}</td>
                {row.to !== '' && (
                  <td className="px-3 sm:px-4 py-3 text-[9px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                      {row.to}
                    </span>
                  </td>
                )}
                {row.to === '' && route.columns.length === 3 && (
                  <td />
                )}
                <td className="px-3 sm:px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-black ${c.pill}`}>
                    <Clock className="w-2.5 h-2.5" /> {row.lt}
                  </span>
                </td>
                {route.hasRest && (
                  <td className="px-3 sm:px-4 py-3 text-[9px] sm:text-[10px] font-bold text-slate-400">
                    {row.rest !== '-' ? row.rest : <span className="text-slate-200 dark:text-slate-700">—</span>}
                  </td>
                )}
              </tr>
            ))}
            {/* Fill empty rows to maintain consistent height */}
            {Array.from({ length: ROWS_PER_PAGE - paged.length }).map((_, i) => (
              <tr key={`empty-${i}`} className="opacity-0 pointer-events-none">
                <td className="px-3 py-3 text-[9px]">&nbsp;</td>
                <td className="px-3 py-3 text-[9px]">&nbsp;</td>
                <td className="px-3 py-3 text-[9px]">&nbsp;</td>
                <td className="px-3 py-3 text-[9px]">&nbsp;</td>
                {route.hasRest && <td className="px-3 py-3 text-[9px]">&nbsp;</td>}
              </tr>
            ))}
          </tbody>
          {/* Footer only on last page */}
          {route.footer && isLastPage && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/40 border-t-2 border-slate-200 dark:border-slate-700">
              {route.footer.map((f) => (
                <tr key={f.label}>
                  <td colSpan={3} className="px-3 sm:px-4 py-3 text-[9px] font-black uppercase tracking-widest text-right text-slate-500 dark:text-slate-400">
                    {f.label}
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    {f.lt && (
                      <span className="inline-flex px-2 py-1 rounded-lg text-[9px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {f.lt}
                      </span>
                    )}
                  </td>
                  {route.hasRest && (
                    <td className="px-3 sm:px-4 py-3">
                      {f.rest && (
                        <span className="inline-flex px-2 py-1 rounded-lg text-[9px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          {f.rest}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
            Hal. {page} dari {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function StandarLeadtimePage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-10">

      {/* ── HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-blue-500/5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-10 opacity-5 dark:opacity-10 pointer-events-none">
          <Timer className="w-64 h-64 text-blue-500 -rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-black tracking-widest uppercase mb-4 border border-blue-100 dark:border-blue-500/20">
            <Timer className="w-3.5 h-3.5" /> Reference Guide
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-3">
            Standar Leadtime
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold max-w-xl leading-relaxed">
            Panduan durasi waktu tempuh standar (Leadtime) untuk armada di berbagai wilayah. Jadikan sebagai acuan performa driver.
          </p>
        </div>
      </motion.div>

      {/* ── GRID 2×2 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
        {routes.map((route, i) => (
          <RouteCard key={route.id} route={route} delay={i * 0.08} />
        ))}
      </div>

      {/* ── ECO DRIVING PARAMETERS ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden"
      >
        {/* Section Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 flex items-center gap-3">
          <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-white/60 dark:bg-slate-900/40">
            <Leaf className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-[11px] sm:text-sm font-black uppercase tracking-tight text-emerald-600 dark:text-emerald-400">
              Standar Parameter Eco Driving
            </h3>
            <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">6 parameter pelanggaran</p>
          </div>
        </div>

        {/* Parameter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y divide-slate-100 dark:divide-slate-800 sm:divide-y-0">
          {[
            {
              icon: <Zap className="w-4 h-4" />,
              color: 'red',
              code: 'OverSpeed',
              label: 'Over Speed',
              desc: 'Kecepatan Melebihi 80 KM/jam',
              threshold: '> 80 km/jam',
            },
            {
              icon: <TrendingDown className="w-4 h-4 rotate-180" />,
              color: 'blue',
              code: 'HA',
              label: 'Harsh Acceleration',
              desc: 'Kenaikan Kecepatan 2.5 m/s atau 10 km/jam dalam 1 detik',
              threshold: '≥ 2.5 m/s² dalam 1 detik',
            },
            {
              icon: <TrendingDown className="w-4 h-4" />,
              color: 'amber',
              code: 'HB',
              label: 'Harsh Braking',
              desc: 'Penurunan Kecepatan 2.5 m/s atau 10 km/jam dalam 1 detik',
              threshold: '≥ 2.5 m/s² dalam 1 detik',
            },
            {
              icon: <RotateCcw className="w-4 h-4" />,
              color: 'purple',
              code: 'HC',
              label: 'Hot Cornering',
              desc: 'Bila kendaraan berbelok lebih dari 20 derajat dalam 1 detik',
              threshold: '> 20° dalam 1 detik',
            },
            {
              icon: <ParkingCircle className="w-4 h-4" />,
              color: 'orange',
              code: 'IS',
              label: 'Illegal Stop',
              desc: 'Berhenti lebih dari 15 menit di tempat yang bukan Rest Point',
              threshold: '> 15 menit di non-RP',
            },
            {
              icon: <Wind className="w-4 h-4" />,
              color: 'slate',
              code: 'IT',
              label: 'Idle Time',
              desc: 'Mesin menyala lebih dari 30 menit tanpa pergerakan',
              threshold: '> 30 menit tanpa gerak',
            },
          ].map((param, i) => {
            const colorStyles: Record<string, { bg: string; text: string; border: string; pill: string; badge: string }> = {
              red:    { bg: 'bg-rose-50 dark:bg-rose-500/10',     text: 'text-rose-600 dark:text-rose-400',     border: 'border-rose-100 dark:border-rose-500/20',     pill: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',     badge: 'bg-rose-500' },
              blue:   { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   border: 'border-blue-100 dark:border-blue-500/20',   pill: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',   badge: 'bg-blue-500' },
              amber:  { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-500/20', pill: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300', badge: 'bg-amber-500' },
              purple: { bg: 'bg-purple-50 dark:bg-purple-500/10',text: 'text-purple-600 dark:text-purple-400',border: 'border-purple-100 dark:border-purple-500/20',pill: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',badge: 'bg-purple-500' },
              orange: { bg: 'bg-orange-50 dark:bg-orange-500/10',text: 'text-orange-600 dark:text-orange-400',border: 'border-orange-100 dark:border-orange-500/20',pill: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',badge: 'bg-orange-500' },
              slate:  { bg: 'bg-slate-50 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-100 dark:border-slate-700',     pill: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300', badge: 'bg-slate-500' },
            };
            const c = colorStyles[param.color];
            return (
              <div
                key={param.code}
                className={`relative p-5 sm:p-6 flex flex-col gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors ${i < 3 ? 'sm:border-b sm:border-slate-100 sm:dark:border-slate-800' : ''} ${i % 3 !== 2 ? 'lg:border-r lg:border-slate-100 lg:dark:border-slate-800' : ''} ${i % 2 === 0 ? 'sm:border-r sm:border-slate-100 sm:dark:border-slate-800 lg:border-r-0' : ''} ${[0,1,3,4].includes(i) ? 'sm:border-r' : ''}`}
              >
                {/* Top row: icon + code badge */}
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl ${c.bg} border ${c.border}`}>
                    <span className={c.text}>{param.icon}</span>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-1 rounded-lg tracking-widest uppercase ${c.pill}`}>
                    {param.code}
                  </span>
                </div>

                {/* Label */}
                <div>
                  <p className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                    {param.label}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1.5">
                    {param.desc}
                  </p>
                </div>

                {/* Threshold pill */}
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    <AlertTriangle className="w-2.5 h-2.5 text-slate-400" />
                    {param.threshold}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

    </div>
  );
}
