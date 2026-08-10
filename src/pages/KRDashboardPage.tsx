import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Phone, Sun, Moon, ChevronLeft, ChevronRight, User, Calendar
} from 'lucide-react';
import DevelopmentNotice from '../components/common/DevelopmentNotice';

// ── Types ──────────────────────────────────────────────────────
type Shift = 'Pagi' | 'Malam' | '-';

interface KRPerson {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  role: string;
  schedule: Record<string, Shift>; // "YYYY-MM-DD" → "Pagi" | "Malam" | "-"
}

// ── Dummy Data ─────────────────────────────────────────────────
// NOTE: Tim ops akan mengisi data ini ke sistem. Saat ini menggunakan contoh data.
const KR_DATA: KRPerson[] = [
  {
    id: '1', name: 'Budi Santoso', phone: '0812-3456-7890', role: 'KR Pagi',
    schedule: buildSchedule('Pagi', ['2026-07-01', '2026-07-03', '2026-07-07', '2026-07-09', '2026-07-14', '2026-07-16', '2026-07-21', '2026-07-23', '2026-07-28', '2026-07-30']),
  },
  {
    id: '2', name: 'Ahmad Fauzi', phone: '0813-5678-9012', role: 'KR Malam',
    schedule: buildSchedule('Malam', ['2026-07-02', '2026-07-04', '2026-07-08', '2026-07-10', '2026-07-15', '2026-07-17', '2026-07-22', '2026-07-24', '2026-07-29', '2026-07-31']),
  },
  {
    id: '3', name: 'Suharto Wijaya', phone: '0821-2345-6789', role: 'KR Pagi',
    schedule: buildSchedule('Pagi', ['2026-07-05', '2026-07-06', '2026-07-11', '2026-07-12', '2026-07-18', '2026-07-19', '2026-07-25', '2026-07-26']),
  },
  {
    id: '4', name: 'Rizki Pratama', phone: '0822-3456-7890', role: 'KR Malam',
    schedule: buildSchedule('Malam', ['2026-07-05', '2026-07-06', '2026-07-11', '2026-07-12', '2026-07-18', '2026-07-19', '2026-07-25', '2026-07-26']),
  },
  {
    id: '5', name: 'Dede Suhendar', phone: '0819-8765-4321', role: 'KR Pagi',
    schedule: buildSchedule('Pagi', ['2026-07-01', '2026-07-02', '2026-07-08', '2026-07-15', '2026-07-16', '2026-07-22', '2026-07-23', '2026-07-29', '2026-07-30']),
  },
];

function buildSchedule(shift: Shift, dates: string[]): Record<string, Shift> {
  const s: Record<string, Shift> = {};
  dates.forEach(d => { s[d] = shift; });
  return s;
}

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function getShiftBadge(shift: Shift) {
  if (shift === 'Pagi') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <Sun className="w-2.5 h-2.5" /> P
    </span>
  );
  if (shift === 'Malam') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
      <Moon className="w-2.5 h-2.5" /> M
    </span>
  );
  return <span className="text-slate-200 dark:text-slate-700 text-[9px]">—</span>;
}

// ── KR Person Card ─────────────────────────────────────────────
function KRCard({ person, today }: { person: KRPerson; today: string }) {
  const todayShift: Shift = person.schedule[today] || '-';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4"
    >
      {/* Avatar + Name */}
      <div className="flex items-center gap-3">
        {person.photo ? (
          <img src={person.photo} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-800 shadow-sm" alt={person.name} />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-sm">
            <User className="w-6 h-6 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 dark:text-white truncate leading-tight">{person.name}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{person.role}</p>
        </div>
        {/* Today's shift badge */}
        <div className="text-right shrink-0">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Hari Ini</p>
          <div className="text-sm">
            {todayShift === 'Pagi' && <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Sun className="w-3 h-3" /> Pagi</span>}
            {todayShift === 'Malam' && <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"><Moon className="w-3 h-3" /> Malam</span>}
            {todayShift === '-' && <span className="text-xs font-black text-slate-300 dark:text-slate-600 px-2 py-1">Libur</span>}
          </div>
        </div>
      </div>

      {/* Phone */}
      <a href={`tel:${person.phone.replace(/-/g, '')}`}
        className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
        <span className="w-7 h-7 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
          <Phone className="w-3.5 h-3.5 text-blue-500" />
        </span>
        {person.phone}
      </a>
    </motion.div>
  );
}

// ── Mini Calendar for one person ───────────────────────────────
function PersonCalendar({ person, year, month }: { person: KRPerson; year: number; month: number }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DAY_NAMES.map(d => (
          <p key={d} className="text-[8px] font-black text-slate-400 py-1">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const shift = person.schedule[dateStr];
          return (
            <div key={day} title={shift ? `${day}: ${shift}` : undefined}
              className={`aspect-square flex items-center justify-center rounded-lg text-[9px] font-black transition-colors
                ${shift === 'Pagi' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                  shift === 'Malam' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' :
                    'text-slate-400 dark:text-slate-600'}`}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function KRDashboardPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<'cards' | 'schedule'>('cards');

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Build master schedule grid ─────────────────────────────────
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const onDutyToday = KR_DATA.filter(p => {
    const s = p.schedule[todayStr];
    return s && s !== '-';
  });

  const TABS = [
    { key: 'cards', label: 'KR Cards' },
    { key: 'schedule', label: 'Jadwal Bulan Ini' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* ── Header ── */}
      <div className="sticky top-4 z-40 px-4 md:px-6">
        <div className="max-w-6xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-white/60 dark:border-slate-800 px-6 h-16 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-violet-500" />
            <span className="font-black text-lg tracking-tight">Jadwal KR</span>
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">Operasional</span>
          </div>
          {/* Month Nav */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="font-black text-sm text-slate-700 dark:text-slate-300 min-w-[120px] text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8 mt-4">
        {/* ── Development notice ── */}
        <DevelopmentNotice message="Fitur Jadwal KR masih dalam tahap pengembangan. Data KR bersifat contoh & belum terhubung ke database." />

        {/* ── Today on duty ── */}
        {onDutyToday.length > 0 && (
          <div className="bg-gradient-to-r from-violet-500 to-indigo-600 rounded-3xl p-5 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/20">
            <p className="text-[10px] font-black tracking-widest uppercase mb-3 text-violet-200">Bertugas Hari Ini</p>
            <div className="flex flex-wrap gap-3">
              {onDutyToday.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-2xl px-3 py-2">
                  {p.photo ? (
                    <img src={p.photo} className="w-6 h-6 rounded-full object-cover" alt={p.name} />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                      <User className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-black leading-tight">{p.name}</p>
                    <p className="text-[9px] text-violet-200 font-semibold">{p.schedule[todayStr] === 'Pagi' ? '☀️ Pagi' : '🌙 Malam'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === t.key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Tab: KR Cards + Calendar ── */}
          {activeTab === 'cards' && (
            <motion.div key="cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {KR_DATA.map(person => (
                  <div key={person.id} className="space-y-3">
                    <KRCard person={person} today={todayStr} />
                    {/* Mini Calendar */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {MONTH_NAMES[viewMonth]} {viewYear}
                      </p>
                      <PersonCalendar person={person} year={viewYear} month={viewMonth} />
                      <div className="flex items-center gap-3 mt-3 text-[9px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-200 dark:bg-amber-900/50 inline-block" /> Pagi</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-200 dark:bg-indigo-900/50 inline-block" /> Malam</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Tab: Master Schedule Table ── */}
          {activeTab === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 overflow-x-auto">
                <h3 className="font-black text-base mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-violet-500" /> Jadwal Lengkap — {MONTH_NAMES[viewMonth]} {viewYear}
                </h3>
                <table className="w-full text-[10px] border-separate border-spacing-y-1" style={{ minWidth: `${120 + daysInMonth * 28}px` }}>
                  <thead>
                    <tr>
                      <th className="text-left pr-3 pb-2 font-black text-slate-400 uppercase tracking-widest w-36">Nama</th>
                      {dayNumbers.map(d => {
                        const dayOfWeek = new Date(viewYear, viewMonth, d).getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        return (
                          <th key={d} className={`w-7 pb-2 text-center font-black ${isWeekend ? 'text-red-400 dark:text-red-500' : 'text-slate-400'}`}>
                            <div>{DAY_NAMES[dayOfWeek]}</div>
                            <div className={isWeekend ? 'text-red-400 dark:text-red-500' : 'text-slate-600 dark:text-slate-400'}>{d}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {KR_DATA.map(person => (
                      <tr key={person.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="pr-3 py-1.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {person.photo ? (
                              <img src={person.photo} className="w-5 h-5 rounded-full object-cover" alt={person.name} />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <User className="w-3 h-3 text-slate-400" />
                              </div>
                            )}
                            <span className="text-xs truncate max-w-[100px]">{person.name}</span>
                          </div>
                        </td>
                        {dayNumbers.map(d => {
                          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const shift = person.schedule[dateStr];
                          const isToday = dateStr === todayStr;
                          return (
                            <td key={d} className={`text-center py-1.5 ${isToday ? 'ring-1 ring-inset ring-violet-300 dark:ring-violet-700 rounded-lg' : ''}`}>
                              {getShiftBadge(shift || '-')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-4 mt-4 text-[10px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200 dark:bg-amber-900/50 inline-block" /> P = Pagi (Shift Pagi)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 dark:bg-indigo-900/50 inline-block" /> M = Malam (Shift Malam)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800 inline-block" /> — = Libur</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
