import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList, Shield, ShieldCheck, Search, Calendar, CheckCircle2, XCircle,
  RefreshCcw, Clock, Info, ChevronLeft, ChevronRight, FileText, X, Printer,
  Pencil, AlertTriangle, Sun, Moon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { P2HRecord } from '../types';
import { TenkoRecord } from '../services/tenkoService';
import { getP2HRecordsByDate, getTenkoRecordsByDate, matchResilientName, upsertP2HRecord } from '../services/gatepassService';
import { P2H_CATEGORIES } from '../constants/p2hItems';
import AuthModal from '../components/auth/AuthModal';
import Avatar from '../components/common/Avatar';
import P2HDocument from '../components/pdf/P2HDocument';
import TenkoDocument from '../components/pdf/TenkoDocument';
import GatepassDocument from '../components/pdf/GatepassDocument';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface DriverRow { id: string; name: string; no_polisi?: string; }

const todayLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const ITEMS_PER_PAGE = 15;
const TOTAL_P2H_ITEMS = P2H_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);

// ─── Tema Claude Amber ───
const T = {
  card: 'bg-white dark:bg-[#201A16] border border-[#E8E6DC] dark:border-[#352C25]',
  panel: 'bg-[#F0EEE6] dark:bg-[#26201B]',
  heading: 'text-[#29261B] dark:text-[#F5F0EC]',
  body: 'text-[#3D3929] dark:text-[#D8CFC7]',
  muted: 'text-[#83827D] dark:text-[#96897E]',
  input: 'bg-white dark:bg-[#201A16] border border-[#E8E6DC] dark:border-[#352C25] rounded-xl text-sm text-[#3D3929] dark:text-[#D8CFC7] placeholder-[#B3B0A6] dark:placeholder-[#5E554C] focus:outline-none focus:border-[#D97757]/60',
  primaryBtn: 'bg-[#D97757] hover:bg-[#C15F3C] text-white',
  ghostBtn: 'bg-[#F0EEE6] dark:bg-[#26201B] hover:bg-[#E8E6DC] dark:hover:bg-[#3A2F28] text-[#3D3929] dark:text-[#D8CFC7]',
};

type GateStatus = 'READY' | 'PENDING' | 'BLOCKED';
type PrintType = 'ALL' | 'GATEPASS' | 'TENKO' | 'P2H';

interface ScheduledDriver {
  id: string; name: string; nopol: string; shift: string; area: string; avatar?: string | null;
}

interface DriverCheck {
  status: GateStatus;
  tenko?: TenkoRecord;
  p2h?: P2HRecord;
  reason?: string;
}

function getTenkoHealth(r: TenkoRecord): { ok: boolean; reason?: string } {
  if (Number(r.alkohol) > 0) return { ok: false, reason: 'Positif Alkohol' };
  if (r.sistolik >= 145 || r.diastolik >= 90) return { ok: false, reason: 'Hipertensi' };
  if (r.sistolik < 90 || r.diastolik < 60) return { ok: false, reason: 'Hipotensi' };
  if (r.suhu_tubuh >= 37.5) return { ok: false, reason: 'Suhu Tinggi' };
  if ((r.fatigue || '').toUpperCase() === 'LELAH') return { ok: false, reason: 'Fatigue / Lelah' };
  if (r.oxygen_saturation < 95) return { ok: false, reason: 'SpO2 Rendah' };
  return { ok: true };
}

async function fetchScheduledDrivers(selectedDate: string): Promise<ScheduledDriver[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('driver_id, no_polisi, shift, area, drivers(name, avatar_url)')
    .eq('tanggal', selectedDate)
    .limit(1000);
  if (error) throw error;

  const unique = new Map<string, ScheduledDriver>();
  for (const r of (data || []) as any[]) {
    if (!r.driver_id || unique.has(r.driver_id)) continue;
    unique.set(r.driver_id, {
      id: r.driver_id,
      name: r.drivers?.name || r.driver_id,
      nopol: r.no_polisi || '-',
      shift: r.shift || '-',
      area: r.area || '-',
      avatar: r.drivers?.avatar_url || null,
    });
  }
  return Array.from(unique.values());
}

function ShiftBadge({ shift }: { shift: string }) {
  const isNight = shift.toUpperCase().includes('NIGHT');
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap ${isNight ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'}`}>
      {isNight ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      {isNight ? 'Night' : 'Day'}
    </span>
  );
}

function Toast({ toast }: { toast: { msg: string; ok: boolean } | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════ TAB P2H ══════════════════════ */

function P2HTab() {
  const [selectedDate, setSelectedDate] = useState(todayLocal);
  const [drivers, setDrivers] = useState<ScheduledDriver[]>([]);
  const [p2hMap, setP2hMap] = useState<Record<string, P2HRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OK' | 'NG' | 'BELUM'>('ALL');
  const [page, setPage] = useState(1);

  // Form input checklist
  const [editing, setEditing] = useState<ScheduledDriver | null>(null);
  const [editingRecord, setEditingRecord] = useState<P2HRecord | null>(null);
  const [checklist, setChecklist] = useState<Record<string, 'OK' | 'NG'>>({});
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<P2HRecord & { name?: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Auth
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  useEscapeKey(() => setIsAuthOpen(false), isAuthOpen);
  useEscapeKey(() => setEditing(null), !!editing);
  useEscapeKey(() => setDetail(null), !!detail);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Jadwal dari table trips (sama seperti monitoring), di-dedupe 1 baris per driver
      const [scheduled, p2hData] = await Promise.all([
        fetchScheduledDrivers(selectedDate),
        getP2HRecordsByDate(selectedDate),
      ]);
      const pm: Record<string, P2HRecord> = {};
      for (const rec of p2hData) pm[rec.driver_id] = rec;
      setDrivers(scheduled);
      setP2hMap(pm);
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Gagal memuat data', false);
    } finally { setIsLoading(false); }
  }, [selectedDate, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterStatus, selectedDate]);

  const executeWithAuth = async (action: () => void) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) action();
    else {
      pendingAction.current = action;
      setIsAuthOpen(true);
    }
  };

  const openInput = (d: ScheduledDriver) => {
    executeWithAuth(() => {
      const rec = p2hMap[d.id] || null;
      setEditingRecord(rec);
      setChecklist(rec?.checklist ? { ...rec.checklist } : {});
      setCatatan(rec?.catatan || '');
      setEditing(d);
    });
  };

  const filledCount = Object.keys(checklist).length;
  const progress = Math.round((filledCount / TOTAL_P2H_ITEMS) * 100);

  const handleSave = async () => {
    if (!editing) return;
    if (filledCount < TOTAL_P2H_ITEMS) {
      showToast(`Lengkapi semua checklist dulu (terisi ${filledCount}/${TOTAL_P2H_ITEMS})`, false);
      return;
    }
    setSaving(true);
    try {
      const hasNG = Object.values(checklist).includes('NG');
      const { data: { session } } = await supabase.auth.getSession();
      const rawUser = session?.user?.email?.split('@')[0] || 'Checker';
      const checkerName = rawUser.split(/[\._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      // Table p2h belum punya unique constraint (driver_id,tanggal),
      // jadi pakai check-then-update/insert, bukan upsert onConflict
      const { data, error } = await upsertP2HRecord({
        tanggal: selectedDate,
        driver_id: editing.id,
        nopol: editing.nopol,
        checked_by: checkerName,
        status: hasNG ? 'NG' : 'OK',
        catatan,
        checklist,
      });

      if (error) throw error;
      if (data) setP2hMap(prev => ({ ...prev, [editing.id]: data as P2HRecord }));
      setEditing(null);
      showToast(hasNG ? 'P2H tersimpan dengan status NG' : 'P2H tersimpan, unit siap operasional', true);
    } catch (e: any) {
      console.error(e);
      showToast(`Gagal menyimpan: ${e?.message || 'error'}`, false);
    } finally { setSaving(false); }
  };

  const filtered = useMemo(() => drivers.filter(d => {
    const rec = p2hMap[d.id];
    const st = !rec ? 'BELUM' : rec.status;
    if (filterStatus !== 'ALL' && st !== filterStatus) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.nopol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [drivers, p2hMap, filterStatus, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    let ok = 0, ng = 0, belum = 0;
    for (const d of drivers) {
      const rec = p2hMap[d.id];
      if (!rec) belum++;
      else if (rec.status === 'OK') ok++;
      else ng++;
    }
    return { total: drivers.length, ok, ng, belum };
  }, [drivers, p2hMap]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ label: 'Total Jadwal', value: stats.total, chip: 'bg-[#D97757]/10 text-[#C15F3C] dark:bg-[#D97757]/15 dark:text-[#DF8260]', icon: <FileText className="w-4 h-4" /> },
          { label: 'Belum Dicek', value: stats.belum, chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', icon: <Clock className="w-4 h-4" /> },
          { label: 'OK', value: stats.ok, chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'NG', value: stats.ng, chip: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', icon: <XCircle className="w-4 h-4" /> }].map(s => (
          <div key={s.label} className={`${T.card} rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.chip}`}>{s.icon}</div>
            <div><div className={`text-xl font-black ${T.heading}`}>{s.value}</div><div className="text-[10px] font-bold text-[#83827D] dark:text-[#96897E] uppercase tracking-widest">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B0A6] dark:text-[#5E554C]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari driver / nopol…"
            className={`w-full pl-9 pr-4 py-2 ${T.input}`} />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'BELUM', 'OK', 'NG'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? (s === 'OK' ? 'bg-emerald-600 text-white' : s === 'NG' ? 'bg-red-600 text-white' : s === 'BELUM' ? 'bg-slate-500 text-white' : `${T.primaryBtn}`) : `${T.ghostBtn} text-[#83827D] dark:text-[#96897E]`}`}>{s}</button>
          ))}
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B0A6] dark:text-[#5E554C]" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className={`pl-9 pr-3 py-2 ${T.input}`} />
        </div>
        <button onClick={load} title="Refresh" className={`p-2 rounded-xl ${T.ghostBtn} text-[#83827D] dark:text-[#96897E] transition-colors`}><RefreshCcw className="w-4 h-4" /></button>
      </div>

      <div className={`${T.card} rounded-2xl overflow-hidden`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCcw className="w-6 h-6 text-[#D97757]" /></motion.div>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList className="w-10 h-10 text-[#DDD9CE] dark:text-[#3A3029]" />
            <p className="text-sm text-[#83827D] dark:text-[#96897E]">Tidak ada jadwal driver untuk {fmtDate(selectedDate)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#E8E6DC] dark:border-[#352C25] bg-[#FAF9F5] dark:bg-[#191411]">
              {['No', 'Driver', 'Nopol', 'Shift', 'Status P2H', 'Dicek Oleh', 'Jam', ''].map(h => (
                <th key={h} className={`text-left px-4 py-3 text-[10px] font-black text-[#83827D] dark:text-[#96897E] uppercase tracking-widest ${h === '' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-[#F0EEE6] dark:divide-[#26201B]">
              {paginated.map((d, i) => {
                const rec = p2hMap[d.id];
                return (
                  <tr key={d.id} className="hover:bg-[#FAF9F5] dark:bg-[#191411] transition-colors dark:hover:bg-[#1A1512]">
                    <td className="px-4 py-3 text-[#B3B0A6] dark:text-[#5E554C] text-xs">{(page - 1) * ITEMS_PER_PAGE + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={d.name} src={d.avatar} />
                        <div>
                          <span className={`font-medium text-xs block ${T.body}`}>{d.name || '-'}</span>
                          <span className="text-[9px] font-bold text-[#83827D] dark:text-[#96897E] uppercase tracking-wider">{d.area || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-xs font-mono ${T.body}`}>{d.nopol || '-'}</td>
                    <td className="px-4 py-3">
                      <ShiftBadge shift={d.shift} />
                    </td>
                    <td className="px-4 py-3">
                      {!rec ? <span className="text-[10px] font-black text-[#B3B0A6] dark:text-[#5E554C] uppercase">Belum Dicek</span>
                        : rec.status === 'OK'
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px] font-black uppercase"><CheckCircle2 className="w-3 h-3" />OK</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 text-[10px] font-black uppercase"><XCircle className="w-3 h-3" />NG</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#83827D] dark:text-[#96897E]">{rec?.checked_by || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#83827D] dark:text-[#96897E]">{rec?.created_at ? new Date(rec.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {rec && rec.checklist && Object.keys(rec.checklist).length > 0 && (
                          <button onClick={() => setDetail({ ...rec, name: d.name })} title="Lihat detail checklist"
                            className="p-1.5 rounded-lg bg-[#F0EEE6] dark:bg-[#26201B] hover:bg-[#E8E6DC] dark:hover:bg-[#3A2F28] text-[#83827D] dark:text-[#96897E] transition-colors"><Info className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => openInput(d)} disabled={saving}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-40 ${rec ? `${T.ghostBtn}` : `${T.primaryBtn}`}`}>
                          {rec ? <><Pencil className="w-3 h-3" />Edit</> : 'Isi P2H'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#83827D] dark:text-[#96897E]">{filtered.length} driver</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className={`p-1.5 rounded-lg border border-[#E8E6DC] dark:border-[#352C25] text-[#83827D] dark:text-[#96897E] disabled:opacity-30`}><ChevronLeft className="w-4 h-4" /></button>
            <span className={`text-xs font-bold ${T.body}`}>{page}/{totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className={`p-1.5 rounded-lg border border-[#E8E6DC] dark:border-[#352C25] text-[#83827D] dark:text-[#96897E] disabled:opacity-30`}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ── MODAL INPUT CHECKLIST P2H ── */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#29261B]/40 backdrop-blur-sm dark:bg-black/60 p-4" onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#201A16] border border-[#E8E6DC] dark:border-[#352C25] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-4 border-b border-[#F0EEE6] dark:border-[#352C25] shrink-0">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#83827D] dark:text-[#96897E] mb-0.5">
                    {editingRecord ? 'Edit P2H' : 'Input P2H'} • {fmtDate(selectedDate)}
                  </p>
                  <h3 className={`text-base font-black ${T.heading}`}>{editing.name}</h3>
                  <p className="text-xs text-[#83827D] dark:text-[#96897E] font-mono mt-0.5">{editing.nopol} • {editing.area} • {editing.shift}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-[#83827D] dark:text-[#96897E] uppercase tracking-widest">Terisi {filledCount}/{TOTAL_P2H_ITEMS}</div>
                    <div className="w-24 h-1.5 bg-[#F0EEE6] dark:bg-[#26201B] rounded-full mt-1 overflow-hidden">
                      <motion.div animate={{ width: `${progress}%` }} className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-[#D97757]'}`} />
                    </div>
                  </div>
                  <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-[#83827D] dark:text-[#96897E] hover:bg-[#F0EEE6] dark:bg-[#26201B]"><X className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Checklist */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {P2H_CATEGORIES.map(cat => {
                  const allOK = cat.items.every(it => checklist[it.id] === 'OK');
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#29261B] dark:text-[#F5F0EC]">{cat.title}</h4>
                        <button onClick={() => setChecklist(prev => {
                          const next = { ...prev };
                          cat.items.forEach(it => { next[it.id] = 'OK'; });
                          return next;
                        })}
                          className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-colors ${allOK ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-[#F0EEE6] dark:bg-[#26201B] text-[#83827D] dark:text-[#96897E] hover:bg-[#E8E6DC] dark:hover:bg-[#3A2F28]'}`}>
                          {allOK ? '✓ Semua OK' : 'Set Semua OK'}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {cat.items.map(item => (
                          <div key={item.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#191411] border border-[#F0EEE6]">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-[#3D3929] dark:text-[#D8CFC7] leading-snug">{item.item}</p>
                              <p className="text-[10px] text-[#83827D] dark:text-[#96897E] leading-snug mt-0.5 italic">{item.syarat}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {(['OK', 'NG'] as const).map(v => {
                                const active = checklist[item.id] === v;
                                return (
                                  <button key={v} onClick={() => setChecklist(prev => ({ ...prev, [item.id]: v }))}
                                    className={`w-10 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${active
                                      ? v === 'OK' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                      : 'bg-white dark:bg-[#26201B] border border-[#E8E6DC] dark:border-[#352C25] text-[#B3B0A6] dark:text-[#5E554C] hover:border-[#D97757]/50'}`}>
                                    {v}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-[#29261B] dark:text-[#F5F0EC] mb-2">Catatan Temuan</h4>
                  <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
                    placeholder="Wajib diisi jika ada item NG (deskripsi temuan)…"
                    className={`w-full ${T.input} resize-none`} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 p-4 border-t border-[#F0EEE6] dark:border-[#352C25] shrink-0">
                <p className="text-[10px] text-[#83827D] dark:text-[#96897E] font-semibold">
                  {Object.values(checklist).includes('NG') ? 'Ada item NG → status P2H otomatis NG' : 'Semua item OK → status P2H otomatis OK'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${T.ghostBtn} text-[#83827D] dark:text-[#96897E]`}>Batal</button>
                  <button onClick={handleSave} disabled={saving || filledCount < TOTAL_P2H_ITEMS}
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${T.primaryBtn} disabled:opacity-40 transition-colors`}>
                    <ClipboardList className="w-3.5 h-3.5" />{saving ? 'Menyimpan…' : 'Simpan P2H'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL DETAIL CHECKLIST ── */}
      <AnimatePresence>
        {detail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#29261B]/40 backdrop-blur-sm dark:bg-black/60 p-4" onClick={() => setDetail(null)}>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#201A16] border border-[#E8E6DC] dark:border-[#352C25] rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-1">
                <h3 className={`text-sm font-black uppercase tracking-widest ${T.heading}`}>Detail Checklist P2H</h3>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg text-[#83827D] dark:text-[#96897E] hover:bg-[#F0EEE6] dark:bg-[#26201B]"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-[#83827D] dark:text-[#96897E] mb-4">{detail.name} • {detail.nopol} • dicek oleh {detail.checked_by || '-'}</p>
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {detail.checklist && Object.entries(detail.checklist).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#191411] border border-[#F0EEE6]">
                    <span className="text-xs font-medium text-[#3D3929] dark:text-[#D8CFC7]">{k}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${v === 'OK' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'}`}>{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toast} />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          setIsAuthOpen(false);
          if (pendingAction.current) { pendingAction.current(); pendingAction.current = null; }
        }} />
    </div>
  );
}

/* ══════════════════════ TAB GATEPASS ══════════════════════ */

function GatepassTab() {
  const [selectedDate, setSelectedDate] = useState(todayLocal);
  const [drivers, setDrivers] = useState<ScheduledDriver[]>([]);
  const [p2hMap, setP2hMap] = useState<Record<string, P2HRecord>>({});
  const [tenkoMap, setTenkoMap] = useState<Record<string, TenkoRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | GateStatus>('ALL');
  const [page, setPage] = useState(1);
  const [printJob, setPrintJob] = useState<{ driver: ScheduledDriver; type: PrintType } | null>(null);
  const [printDateTime, setPrintDateTime] = useState('');
  const [printSeq, setPrintSeq] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scheduled, p2hData, tenkoData] = await Promise.all([
        fetchScheduledDrivers(selectedDate),
        getP2HRecordsByDate(selectedDate),
        getTenkoRecordsByDate(selectedDate),
      ]);
      setDrivers(scheduled);

      const pm: Record<string, P2HRecord> = {};
      for (const rec of p2hData) pm[rec.driver_id] = rec;
      setP2hMap(pm);

      const tm: Record<string, TenkoRecord> = {};
      for (const d of scheduled) {
        const found = tenkoData.find(t =>
          t.driver_id === d.id ||
          (!!t.nik && t.nik === d.id) ||
          matchResilientName(t.nama_driver, d.name)
        );
        if (found) tm[d.id] = found;
      }
      setTenkoMap(tm);
    } finally { setIsLoading(false); }
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterStatus, selectedDate]);

  const checkFor = useCallback((d: ScheduledDriver): DriverCheck => {
    const tenko = tenkoMap[d.id];
    const p2h = p2hMap[d.id];
    if (tenko) {
      const h = getTenkoHealth(tenko);
      if (!h.ok) return { status: 'BLOCKED', tenko, p2h, reason: `Tenko NG (${h.reason})` };
    }
    if (p2h?.status === 'NG') return { status: 'BLOCKED', tenko, p2h, reason: 'P2H NG' };
    if (tenko && p2h?.status === 'OK') return { status: 'READY', tenko, p2h };
    return { status: 'PENDING', tenko, p2h, reason: !tenko ? 'Tenko belum dicek' : 'P2H belum diisi' };
  }, [tenkoMap, p2hMap]);

  const filtered = useMemo(() => drivers.filter(d => {
    const st = checkFor(d).status;
    if (filterStatus !== 'ALL' && st !== filterStatus) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.nopol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [drivers, filterStatus, search, checkFor]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    let ready = 0, pending = 0, blocked = 0;
    for (const d of drivers) {
      const s = checkFor(d).status;
      if (s === 'READY') ready++;
      else if (s === 'BLOCKED') blocked++;
      else pending++;
    }
    return { total: drivers.length, ready, pending, blocked };
  }, [drivers, checkFor]);

  const handlePrint = async (d: ScheduledDriver, type: PrintType) => {
    const chk = checkFor(d);
    if (chk.status !== 'READY') return;

    // Buka tab baru secara sinkron agar tidak terkena popup blocker
    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      pdfWindow.document.write(`
        <html><head><title>Menyiapkan PDF...</title></head>
        <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #faf9f5; color: #3d3929;">
          <div style="width: 40px; height: 40px; border: 4px solid #d97757; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
          <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 2px;">Memproses Dokumen</h2>
          <p style="font-size: 14px; color: #83827d;">Mohon tunggu, sedang merender PDF...</p>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </body></html>
      `);
    }

    const now = new Date();
    setPrintDateTime(`${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`);
    setPrintSeq(filtered.findIndex(x => x.id === d.id) + 1);
    setPrintJob({ driver: d, type });

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const capture = async (elId: string, w: number, h: number): Promise<string> => {
        const el = document.getElementById(elId);
        if (!el) throw new Error(`Element #${elId} not found`);
        const htmlToImage = await import('html-to-image');
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout capture ${elId}`)), 10000));
        return Promise.race([
          htmlToImage.toJpeg(el, { quality: 0.95, backgroundColor: '#ffffff', width: w, height: h, pixelRatio: 2 }),
          timeoutPromise,
        ]);
      };

      const { jsPDF } = await import('jspdf');
      let finalPdf: InstanceType<typeof jsPDF> | null = null;

      if (type === 'ALL') {
        const gpData = await capture('gatepass-print-document', 800, 800);
        const tenkoData = await capture('tenko-print-document', 794, 1123);
        const p2hData = await capture('p2h-print-document', 794, 1123);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [210, 210] });
        finalPdf.addImage(gpData, 'JPEG', 0, 0, 210, 210);
        finalPdf.addPage('a4', 'p');
        finalPdf.addImage(tenkoData, 'JPEG', 0, 0, 210, 297);
        finalPdf.addPage('a4', 'p');
        finalPdf.addImage(p2hData, 'JPEG', 0, 0, 210, 297);
      } else if (type === 'GATEPASS') {
        const gpData = await capture('gatepass-print-document', 800, 800);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [210, 210] });
        finalPdf.addImage(gpData, 'JPEG', 0, 0, 210, 210);
      } else if (type === 'TENKO') {
        const tenkoData = await capture('tenko-print-document', 794, 1123);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        finalPdf.addImage(tenkoData, 'JPEG', 0, 0, 210, 297);
      } else if (type === 'P2H') {
        const p2hData = await capture('p2h-print-document', 794, 1123);
        finalPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        finalPdf.addImage(p2hData, 'JPEG', 0, 0, 210, 297);
      }

      if (finalPdf) {
        const blobUrl = finalPdf.output('bloburl');
        if (pdfWindow) {
          pdfWindow.location.href = blobUrl as unknown as string;
        } else {
          const link = document.createElement('a');
          link.href = blobUrl as unknown as string;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (pdfWindow) pdfWindow.close();
      alert(`Gagal mencetak. Error: ${(error as Error).message}`);
    } finally {
      setPrintJob(null);
    }
  };

  const printJobCheck = printJob ? checkFor(printJob.driver) : null;
  const docNumber = `KRW/GP/${selectedDate.replace(/-/g, '')}/${String(printSeq).padStart(3, '0')}`;

  const statusBadge = (s: GateStatus) => {
    if (s === 'READY') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px] font-black uppercase"><ShieldCheck className="w-3 h-3" />Boleh Jalan</span>;
    if (s === 'BLOCKED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 text-[10px] font-black uppercase"><XCircle className="w-3 h-3" />Tidak Lolos</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 text-[10px] font-black uppercase"><Clock className="w-3 h-3" />Pending</span>;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ label: 'Total Jadwal', value: stats.total, chip: 'bg-[#D97757]/10 text-[#C15F3C] dark:bg-[#D97757]/15 dark:text-[#DF8260]', icon: <FileText className="w-4 h-4" /> },
          { label: 'Siap Jalan', value: stats.ready, chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Pending', value: stats.pending, chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', icon: <Clock className="w-4 h-4" /> },
          { label: 'Tidak Lolos', value: stats.blocked, chip: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', icon: <XCircle className="w-4 h-4" /> }].map(s => (
          <div key={s.label} className={`${T.card} rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.chip}`}>{s.icon}</div>
            <div><div className={`text-xl font-black ${T.heading}`}>{s.value}</div><div className="text-[10px] font-bold text-[#83827D] dark:text-[#96897E] uppercase tracking-widest">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B0A6] dark:text-[#5E554C]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari driver / nopol…"
            className={`w-full pl-9 pr-4 py-2 ${T.input}`} />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'READY', 'PENDING', 'BLOCKED'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? (s === 'READY' ? 'bg-emerald-600 text-white' : s === 'BLOCKED' ? 'bg-red-600 text-white' : s === 'PENDING' ? 'bg-amber-500 text-white' : `${T.primaryBtn}`) : `${T.ghostBtn} text-[#83827D] dark:text-[#96897E]`}`}>{s === 'BLOCKED' ? 'NG' : s}</button>
          ))}
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B0A6] dark:text-[#5E554C]" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className={`pl-9 pr-3 py-2 ${T.input}`} />
        </div>
        <button onClick={load} title="Refresh" className={`p-2 rounded-xl ${T.ghostBtn} text-[#83827D] dark:text-[#96897E] transition-colors`}><RefreshCcw className="w-4 h-4" /></button>
      </div>

      <div className={`${T.card} rounded-2xl overflow-hidden`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCcw className="w-6 h-6 text-[#D97757]" /></motion.div>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield className="w-10 h-10 text-[#DDD9CE] dark:text-[#3A3029]" />
            <p className="text-sm text-[#83827D] dark:text-[#96897E]">Tidak ada jadwal driver untuk {fmtDate(selectedDate)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#E8E6DC] dark:border-[#352C25] bg-[#FAF9F5] dark:bg-[#191411]">
              {['No', 'Driver', 'Nopol', 'Shift', 'Tenko', 'P2H', 'Gatepass', ''].map(h => (
                <th key={h} className={`text-left px-4 py-3 text-[10px] font-black text-[#83827D] dark:text-[#96897E] uppercase tracking-widest ${h === '' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-[#F0EEE6] dark:divide-[#26201B]">
              {paginated.map((d, i) => {
                const chk = checkFor(d);
                return (
                  <tr key={d.id} className="hover:bg-[#FAF9F5] dark:bg-[#191411] transition-colors dark:hover:bg-[#1A1512]">
                    <td className="px-4 py-3 text-[#B3B0A6] dark:text-[#5E554C] text-xs">{(page - 1) * ITEMS_PER_PAGE + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={d.name} src={d.avatar} />
                        <div>
                          <span className={`font-medium text-xs block ${T.body}`}>{d.name || '-'}</span>
                          <span className="text-[9px] font-bold text-[#83827D] dark:text-[#96897E] uppercase tracking-wider">{d.area || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-xs font-mono ${T.body}`}>{d.nopol || '-'}</td>
                    <td className="px-4 py-3">
                      <ShiftBadge shift={d.shift} />
                    </td>
                    <td className="px-4 py-3">
                      {!chk.tenko ? <span className="text-[10px] font-black text-[#B3B0A6] dark:text-[#5E554C] uppercase">Belum</span>
                        : getTenkoHealth(chk.tenko).ok
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase"><CheckCircle2 className="w-3 h-3" />OK</span>
                          : <span title={getTenkoHealth(chk.tenko).reason}><XCircle className="w-3.5 h-3.5 text-red-500" /></span>}
                    </td>
                    <td className="px-4 py-3">
                      {!chk.p2h ? <span className="text-[10px] font-black text-[#B3B0A6] dark:text-[#5E554C] uppercase">Belum</span>
                        : chk.p2h.status === 'OK'
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase"><CheckCircle2 className="w-3 h-3" />OK</span>
                          : <span title={chk.p2h.catatan || 'P2H NG'}><XCircle className="w-3.5 h-3.5 text-red-500" /></span>}
                    </td>
                    <td className="px-4 py-3">{statusBadge(chk.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {chk.status === 'READY' ? (
                          <>
                            <button onClick={() => handlePrint(d, 'ALL')} disabled={!!printJob}
                              title="Cetak Semua (Gatepass + Tenko + P2H)"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-40 ${T.primaryBtn}`}>
                              <Printer className="w-3 h-3" />Semua
                            </button>
                            <button onClick={() => handlePrint(d, 'GATEPASS')} disabled={!!printJob} title="Cetak Gatepass"
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-40 ${T.ghostBtn}`}>GP</button>
                            <button onClick={() => handlePrint(d, 'TENKO')} disabled={!!printJob} title="Cetak Tenko"
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-40 ${T.ghostBtn}`}>TK</button>
                            <button onClick={() => handlePrint(d, 'P2H')} disabled={!!printJob} title="Cetak P2H"
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-40 ${T.ghostBtn}`}>P2H</button>
                          </>
                        ) : (
                          <span className="text-[9px] font-bold text-[#B3B0A6] dark:text-[#5E554C] uppercase tracking-wider" title={chk.reason}>
                            {chk.reason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#83827D] dark:text-[#96897E]">{filtered.length} driver</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className={`p-1.5 rounded-lg border border-[#E8E6DC] dark:border-[#352C25] text-[#83827D] dark:text-[#96897E] disabled:opacity-30`}><ChevronLeft className="w-4 h-4" /></button>
            <span className={`text-xs font-bold ${T.body}`}>{page}/{totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className={`p-1.5 rounded-lg border border-[#E8E6DC] dark:border-[#352C25] text-[#83827D] dark:text-[#96897E] disabled:opacity-30`}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Overlay loading cetak */}
      <AnimatePresence>
        {printJob && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#29261B]/50 backdrop-blur-sm dark:bg-black/70">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <RefreshCcw className="w-8 h-8 text-[#D97757] mb-4" />
            </motion.div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Mencetak Dokumen…</p>
            <p className="text-[10px] text-white/70 font-bold mt-1">Menyiapkan {printJob.type === 'ALL' ? '3 lembar PDF (Gatepass + Tenko + P2H)' : 'dokumen PDF'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dokumen off-screen untuk dirender saat pencetakan */}
      {printJob && printJobCheck && (
        <div className="absolute top-0 left-0 opacity-0 pointer-events-none z-[-9999]">
          {(printJob.type === 'GATEPASS' || printJob.type === 'ALL') && (
            <GatepassDocument
              driverName={printJob.driver.name}
              nopol={printJob.driver.nopol}
              area={printJob.driver.area}
              shift={printJob.driver.shift}
              date={selectedDate}
              docNumber={docNumber}
              printDateTime={printDateTime}
              p2hRecord={printJobCheck.p2h}
              tenkoRecord={printJobCheck.tenko}
            />
          )}
          {(printJob.type === 'TENKO' || printJob.type === 'ALL') && printJobCheck.tenko && (
            <TenkoDocument tenko={printJobCheck.tenko} />
          )}
          {(printJob.type === 'P2H' || printJob.type === 'ALL') && printJobCheck.p2h && (
            <P2HDocument
              driverName={printJob.driver.name}
              nopol={printJobCheck.p2h.nopol !== '-' ? printJobCheck.p2h.nopol : printJob.driver.nopol}
              date={selectedDate}
              checklist={printJobCheck.p2h.checklist || {}}
              checkerName={printJobCheck.p2h.checked_by}
              catatan={printJobCheck.p2h.catatan}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════ PAGE WRAPPER ══════════════════════ */

type Tab = 'p2h' | 'gatepass';

export default function P2HGatepassPage() {
  const [activeTab, setActiveTab] = useState<Tab>('p2h');
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'p2h', label: 'P2H', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'gatepass', label: 'Gatepass', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] dark:bg-[#191411] text-[#3D3929] dark:text-[#D8CFC7] px-4 py-6 md:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D97757] to-[#C15F3C] flex items-center justify-center shadow-lg shadow-[#D97757]/25">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#29261B] dark:text-[#F5F0EC] tracking-tight">P2H &amp; Gatepass</h1>
            <p className="text-[11px] text-[#83827D] dark:text-[#96897E] font-medium uppercase tracking-widest">Pemeriksaan &amp; Dokumentasi Keberangkatan</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-[#F0EEE6] dark:bg-[#26201B] border border-[#E8E6DC] dark:border-[#352C25] rounded-2xl p-1.5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 ${activeTab === t.id ? 'bg-gradient-to-r from-[#D97757] to-[#C15F3C] text-white shadow-md shadow-[#D97757]/25' : 'text-[#83827D] hover:text-[#3D3929] dark:text-[#96897E] dark:hover:text-[#F5F0EC]'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {activeTab === 'p2h' ? <P2HTab /> : <GatepassTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
