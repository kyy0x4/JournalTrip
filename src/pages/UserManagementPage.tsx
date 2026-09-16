import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Crown, ShieldCheck, Eye, UserPlus, Users, RefreshCw } from 'lucide-react';
import { OWNER_EMAIL, ADMIN_EMAIL, TAM_EMAIL, getRoleLabel, type RoleLabel } from '../constants/roles';

interface ProfileRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  jabatan: string | null;
  area: string | null;
  phone: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

const ROLE_META: Record<RoleLabel, { desc: string; badge: string; icon: typeof Crown }> = {
  Owner: {
    desc: 'Akses penuh + Kelola User. Bisa edit semua (evaluasi cancel, evidence tensi).',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    icon: Crown,
  },
  Admin: {
    desc: 'Bisa edit (evaluasi cancel, evidence tensi, Admin Foto Driver).',
    badge: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    icon: ShieldCheck,
  },
  TAM: {
    desc: 'View TAM (JBK, NGORO, SUMATERA, ...). Menu internal disembunyikan.',
    badge: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    icon: Eye,
  },
  User: {
    desc: 'View standar (cth: opsmonitoring). Tidak bisa edit, Admin Foto disembunyikan.',
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    icon: Users,
  },
};

const KNOWN_ACCOUNTS: { email: string; note: string }[] = [
  { email: OWNER_EMAIL, note: 'Owner' },
  { email: ADMIN_EMAIL, note: 'Admin' },
  { email: TAM_EMAIL, note: 'TAM' },
];

export default function UserManagementPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, email, full_name, jabatan, area, phone, avatar_url, updated_at')
      .order('updated_at', { ascending: false });
    setProfiles((data as ProfileRow[]) || []);
    setIsLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-500" /> Kelola User
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Struktur role & akun yang pernah isi profil · khusus owner
        </p>
      </div>

      {/* ── Struktur role ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(ROLE_META) as RoleLabel[]).map(role => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <div key={role} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-amber-500" />
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${meta.badge}`}>{role}</span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{meta.desc}</p>
            </div>
          );
        })}
      </div>

      {/* ── Akun dikenal ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-black text-base">Akun Terdaftar</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-4">Role ngikutin email otomatis (diatur di <span className="font-bold text-slate-500">src/constants/roles.ts</span>).</p>
        <div className="space-y-2">
          {KNOWN_ACCOUNTS.map(a => {
            const role = getRoleLabel(a.email);
            return (
              <div key={a.email} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{a.email}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${ROLE_META[role].badge}`}>{role}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            <span className="text-xs font-bold text-slate-500">Email lain (cth: opsmonitoring)</span>
            <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${ROLE_META.User.badge}`}>User</span>
          </div>
        </div>
      </div>

      {/* ── Profil yang sudah diisi ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-red-500" /> Profil Pengguna
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLoading ? 'Memuat...' : `${profiles.length} user sudah isi profil`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void load(); }}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Jabatan / Area</th>
                <th className="px-6 py-4">Telepon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-xs font-bold text-slate-400">Memuat...</td></tr>
              ) : profiles.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-xs font-bold text-slate-400">Belum ada user yang isi profil.</td></tr>
              ) : (
                profiles.map(p => {
                  const role = getRoleLabel(p.email);
                  return (
                    <tr key={p.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900 dark:text-white">{p.full_name || p.email?.split('@')[0] || '—'}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{p.email || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${ROLE_META[role].badge}`}>{role}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{[p.jabatan, p.area].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{p.phone || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cara tambah akun ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50/60 dark:bg-blue-500/5 rounded-3xl border border-blue-100 dark:border-blue-900/30 p-6"
      >
        <h2 className="font-black text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <UserPlus className="w-4 h-4" /> Tambah Akun Baru
        </h2>
        <ol className="mt-3 space-y-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed list-decimal list-inside">
          <li>Buka Supabase Dashboard → Authentication → Users → Add user → Create new user.</li>
          <li>Isi email + password, centang Auto Confirm User.</li>
          <li>Role otomatis ngikutin email. Email baru = User biasa (cukup untuk opsmonitoring).</li>
          <li>Kalau mau jadikan Admin/TAM, ubah email-nya di <span className="font-bold text-slate-600 dark:text-slate-300">src/constants/roles.ts</span> lalu deploy ulang.</li>
        </ol>
      </motion.div>
    </div>
  );
}
