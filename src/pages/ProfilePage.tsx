import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Camera, Save, Lock, Mail, Phone,
  Briefcase, Building2, MapPin, FileText, AtSign, ShieldCheck, Loader2, ImagePlus, Trash2
} from 'lucide-react';
import { isOwnerUser, isTAMUser, ADMIN_EMAIL, getRoleLabel } from '../constants/roles';

function DefaultCover() {
  return (
    <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
      <defs>
        <linearGradient id="coverSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="55%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
        <linearGradient id="coverFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93a8c4" />
          <stop offset="100%" stopColor="#6b86a8" />
        </linearGradient>
        <linearGradient id="coverNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4d7c5f" />
          <stop offset="100%" stopColor="#2d5a43" />
        </linearGradient>
      </defs>
      <rect width="1200" height="400" fill="url(#coverSky)" />
      <circle cx="880" cy="110" r="46" fill="#fef9c3" />
      <circle cx="880" cy="110" r="70" fill="#fef9c3" opacity="0.25" />
      <ellipse cx="240" cy="90" rx="120" ry="34" fill="#ffffff" opacity="0.8" />
      <ellipse cx="340" cy="70" rx="90" ry="28" fill="#ffffff" opacity="0.7" />
      <ellipse cx="1020" cy="60" rx="110" ry="30" fill="#ffffff" opacity="0.7" />
      <path d="M0 260 L180 130 L300 220 L430 110 L600 250 L740 150 L900 260 L1040 170 L1200 260 L1200 400 L0 400 Z" fill="url(#coverFar)" />
      <path d="M180 130 L215 162 L160 175 L185 205 L150 230 L200 250 L240 215 L225 180 Z" fill="#ffffff" opacity="0.85" />
      <path d="M430 110 L470 148 L415 165 L445 200 L395 225 L455 250 L500 210 L480 170 Z" fill="#ffffff" opacity="0.85" />
      <path d="M0 310 Q200 270 420 305 T840 300 T1200 310 L1200 400 L0 400 Z" fill="url(#coverNear)" />
      <path d="M0 345 Q260 320 520 348 T1040 342 T1200 348 L1200 400 L0 400 Z" fill="#1f4433" opacity="0.9" />
    </svg>
  );
}

interface ProfileForm {
  full_name: string;
  nickname: string;
  phone: string;
  jabatan: string;
  departemen: string;
  area: string;
  bio: string;
}

const EMPTY_FORM: ProfileForm = {
  full_name: '', nickname: '', phone: '', jabatan: '', departemen: '', area: '', bio: '',
};

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [isSavingPw, setIsSavingPw] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (cancelled) return;
      setUserId(user.id);
      setEmail(user.email || '');
      let row: any = null;
      const withCover = await supabase
        .from('user_profiles')
        .select('full_name, nickname, phone, jabatan, departemen, area, bio, avatar_url, cover_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (withCover.error) {
        const fallback = await supabase
          .from('user_profiles')
          .select('full_name, nickname, phone, jabatan, departemen, area, bio, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (fallback.error) {
          console.error('load profile error:', fallback.error.message);
        }
        row = fallback.data;
      } else {
        row = withCover.data;
      }
      const data = row;
      if (cancelled) return;
      if (data) {
        setForm({
          full_name: data.full_name || '',
          nickname: data.nickname || '',
          phone: data.phone || '',
          jabatan: data.jabatan || '',
          departemen: data.departemen || '',
          area: data.area || '',
          bio: data.bio || '',
        });
        setAvatarUrl(data.avatar_url || null);
        setCoverUrl(data.cover_url || null);
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);

  const displayName = form.full_name.trim() || email.split('@')[0] || 'User';

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('user_profiles').upsert({
        user_id: userId,
        email,
        full_name: form.full_name.trim() || null,
        nickname: form.nickname.trim() || null,
        phone: form.phone.trim() || null,
        jabatan: form.jabatan.trim() || null,
        departemen: form.departemen.trim() || null,
        area: form.area.trim() || null,
        bio: form.bio.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) {
        console.error('save profile error:', error.message);
        throw error;
      }
      showToast('Profil berhasil disimpan!', 'success');
    } catch (e: any) {
      console.error('save profile error:', e?.message || e);
      showToast(e?.message || 'Gagal menyimpan profil.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 5MB.', 'error');
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/avatar_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('user-avatars').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path);
      const { error: dbError } = await supabase.from('user_profiles').upsert({
        user_id: userId,
        email,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (dbError) throw dbError;
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/user-avatars/')[1];
        if (oldPath) await supabase.storage.from('user-avatars').remove([decodeURIComponent(oldPath)]);
      }
      setAvatarUrl(publicUrl);
      showToast('Foto profil berhasil diupload!', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Gagal upload foto.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!userId || !avatarUrl) return;
    if (!confirm('Hapus foto profil?')) return;
    setIsUploading(true);
    try {
      const oldPath = avatarUrl.split('/user-avatars/')[1];
      if (oldPath) await supabase.storage.from('user-avatars').remove([decodeURIComponent(oldPath)]);
      const { error } = await supabase
        .from('user_profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      setAvatarUrl(null);
      showToast('Foto profil dihapus.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Gagal hapus foto.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverUpload = async (file: File | undefined) => {
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Ukuran sampul maksimal 8MB.', 'error');
      return;
    }
    setIsUploadingCover(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/cover_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('user-avatars').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path);
      const { error: dbError } = await supabase.from('user_profiles').upsert({
        user_id: userId,
        email,
        cover_url: publicUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (dbError) throw dbError;
      if (coverUrl) {
        const oldPath = coverUrl.split('/user-avatars/')[1];
        if (oldPath) await supabase.storage.from('user-avatars').remove([decodeURIComponent(oldPath)]);
      }
      setCoverUrl(publicUrl);
      showToast('Foto sampul berhasil diupload!', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Gagal upload sampul.', 'error');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverDelete = async () => {
    if (!userId || !coverUrl) return;
    if (!confirm('Kembalikan sampul ke default pemandangan?')) return;
    setIsUploadingCover(true);
    try {
      const oldPath = coverUrl.split('/user-avatars/')[1];
      if (oldPath) await supabase.storage.from('user-avatars').remove([decodeURIComponent(oldPath)]);
      const { error } = await supabase
        .from('user_profiles')
        .update({ cover_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      setCoverUrl(null);
      showToast('Sampul dikembalikan ke default.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Gagal hapus sampul.', 'error');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!pw.next || pw.next.length < 6) {
      showToast('Password baru minimal 6 karakter.', 'error');
      return;
    }
    if (pw.next !== pw.confirm) {
      showToast('Konfirmasi password tidak cocok.', 'error');
      return;
    }
    setIsSavingPw(true);
    try {
      if (pw.current) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pw.current });
        if (signInError) throw new Error('Password saat ini salah.');
      }
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      setPw({ current: '', next: '', confirm: '' });
      showToast('Password berhasil diubah!', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Gagal ubah password.', 'error');
    } finally {
      setIsSavingPw(false);
    }
  };

  const set = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const inputCls = 'w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-red-500/20 outline-none text-slate-800 dark:text-slate-100';
  const labelCls = 'flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5';

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-20 animate-pulse">
        <div className="h-48 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header kartu ala Facebook ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="relative h-48 sm:h-64 overflow-hidden bg-slate-200 dark:bg-slate-800 group/cover">
          {coverUrl ? (
            <img src={coverUrl} alt="Sampul" className="w-full h-full object-cover" />
          ) : (
            <DefaultCover />
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          {isUploadingCover && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
              <span className="text-xs font-black text-white uppercase">Mengupload...</span>
            </div>
          )}
          <div className="absolute right-4 bottom-4 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover/cover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              disabled={isUploadingCover}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/90 text-[10px] font-black uppercase text-slate-700 dark:text-slate-200 shadow-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {coverUrl ? 'Ganti Sampul' : 'Tambah Sampul'}
            </button>
            {coverUrl && (
              <button
                type="button"
                onClick={() => { void handleCoverDelete(); }}
                disabled={isUploadingCover}
                className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/90 text-rose-500 shadow-lg hover:bg-white transition-colors disabled:opacity-50"
                title="Kembalikan ke default"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void handleCoverUpload(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
            <div className="relative shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-9 h-9 text-slate-400" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-700 transition-colors disabled:opacity-50"
                title="Ubah foto"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { void handleAvatarUpload(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
            <div className="flex-1 min-w-0 pt-1 sm:pb-1">
              <h1 className="text-xl font-black text-slate-900 dark:text-white truncate">{displayName}</h1>
              <p className="text-xs font-bold text-slate-400 truncate">{email}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {isOwnerUser(email) && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Owner</span>
                )}
                {email === ADMIN_EMAIL && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">Admin</span>
                )}
                {isTAMUser(email) && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">TAM</span>
                )}
                {form.jabatan && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{form.jabatan}</span>
                )}
              </div>
            </div>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => { void handleAvatarDelete(); }}
                disabled={isUploading}
                className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
              >
                Hapus foto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Data diri ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-black text-base flex items-center gap-2">
          <User className="w-4 h-4 text-red-500" /> Data Diri
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-5">Lengkapi profil biar tim lain gampang kenalin kamu.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}><User className="w-3 h-3" /> Nama Lengkap</label>
            <input value={form.full_name} onChange={set('full_name')} placeholder="Nama lengkap" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><AtSign className="w-3 h-3" /> Nama Panggilan</label>
            <input value={form.nickname} onChange={set('nickname')} placeholder="Nama panggilan" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Mail className="w-3 h-3" /> Email (dari akun login)</label>
            <input value={email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className={labelCls}><Phone className="w-3 h-3" /> No. Telepon / WA</label>
            <input value={form.phone} onChange={set('phone')} placeholder="08xx-xxxx-xxxx" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Briefcase className="w-3 h-3" /> Jabatan</label>
            <input value={form.jabatan} onChange={set('jabatan')} placeholder="cth: Koordinator, Checker, Admin" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Building2 className="w-3 h-3" /> Departemen</label>
            <input value={form.departemen} onChange={set('departemen')} placeholder="cth: Operasional, HSE, TAM" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><MapPin className="w-3 h-3" /> Area / Cabang</label>
            <input value={form.area} onChange={set('area')} placeholder="cth: KARAWANG, BEKASI, JBK" className={inputCls} />
          </div>
          <div className="sm:row-span-1">
            <label className={labelCls}><ShieldCheck className="w-3 h-3" /> Role Akun</label>
            <input
              value={getRoleLabel(email)}
              disabled
              className={`${inputCls} opacity-60 cursor-not-allowed`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}><FileText className="w-3 h-3" /> Bio Singkat</label>
            <textarea value={form.bio} onChange={set('bio')} placeholder="Ceritain sedikit tentang kamu..." rows={3} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 shadow-lg shadow-red-500/20"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </div>

      {/* ── Ubah password ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-black text-base flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-500" /> Ubah Password
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-5">Minimal 6 karakter. Isi password saat ini biar aman.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Password Saat Ini</label>
            <input type="password" value={pw.current} onChange={(e) => setPw(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Password Baru</label>
            <input type="password" value={pw.next} onChange={(e) => setPw(p => ({ ...p, next: e.target.value }))} placeholder="Minimal 6 karakter" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Konfirmasi Baru</label>
            <input type="password" value={pw.confirm} onChange={(e) => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Ulangi password baru" className={inputCls} />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => { void handlePasswordChange(); }}
            disabled={isSavingPw}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            {isSavingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {isSavingPw ? 'Menyimpan...' : 'Ubah Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
