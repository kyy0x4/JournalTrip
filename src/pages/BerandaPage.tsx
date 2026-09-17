import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, ImagePlus, Send, MessageCircle, CheckCircle2,
  RotateCcw, Trash2, Loader2, X, RefreshCw, User,
} from 'lucide-react';
import { canPostHandover, getRoleLabel, isTenkoUser, isOwnerUser, ADMIN_EMAIL } from '../constants/roles';

interface HandoverPost {
  id: string;
  author_id: string | null;
  author_email: string | null;
  author_name: string | null;
  content: string;
  photo_url: string | null;
  status: 'open' | 'done';
  created_at: string;
}

interface HandoverComment {
  id: string;
  post_id: string;
  author_id: string | null;
  author_email: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shiftBadge(email?: string | null) {
  if (isTenkoUser(email)) return { label: 'Tenko', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' };
  if (email === ADMIN_EMAIL) return { label: 'MCC', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' };
  return { label: getRoleLabel(email), cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
}

export default function BerandaPage() {
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [posts, setPosts] = useState<HandoverPost[]>([]);
  const [comments, setComments] = useState<Record<string, HandoverComment[]>>({});
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, { name: string | null; avatar: string | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [composer, setComposer] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canPost = canPostHandover(email);

  const mergeAuthorProfiles = useCallback(async (ids: (string | null)[]) => {
    const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
    if (uniq.length === 0) return;
    const { data: profs, error: profErr } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, nickname, avatar_url')
      .in('user_id', uniq);
    if (profErr) {
      console.error('load author profiles error:', profErr.message);
      return;
    }
    const map: Record<string, { name: string | null; avatar: string | null }> = {};
    for (const pr of profs || []) {
      map[pr.user_id] = {
        name: pr.full_name || pr.nickname || null,
        avatar: pr.avatar_url || null,
      };
    }
    if (Object.keys(map).length > 0) setAuthorProfiles(prev => ({ ...prev, ...map }));
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      setEmail(user.email || '');
      setUserId(user.id);
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('full_name, nickname, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      setMyName(prof?.full_name || prof?.nickname || user.email?.split('@')[0] || 'User');
      setMyAvatar(prof?.avatar_url || null);
    }
    const { data: postRows, error: postErr } = await supabase
      .from('handover_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (postErr) {
      setError(`Gagal muat beranda: ${postErr.message}`);
      setIsLoading(false);
      return;
    }
    const list = (postRows as HandoverPost[]) || [];
    setPosts(list);
    if (list.length > 0) {
      const ids = list.map(p => p.id);
      const { data: commentRows } = await supabase
        .from('handover_comments')
        .select('*')
        .in('post_id', ids)
        .order('created_at', { ascending: true });
      const map: Record<string, HandoverComment[]> = {};
      for (const c of (commentRows as HandoverComment[]) || []) {
        (map[c.post_id] = map[c.post_id] || []).push(c);
      }
      setComments(map);
      const postAuthorIds = list.map(p => p.author_id);
      const commentAuthorIds = Object.values(map).flat().map(c => c.author_id);
      await mergeAuthorProfiles([...postAuthorIds, ...commentAuthorIds]);
    }
    setIsLoading(false);
  }, [mergeAuthorProfiles]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const applyPost = (p: HandoverPost) =>
      setPosts(prev => {
        const i = prev.findIndex(x => x.id === p.id);
        if (i === -1) return [p, ...prev].slice(0, 50);
        const next = [...prev];
        next[i] = p;
        return next;
      });
    const ch = supabase
      .channel('beranda-handover')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'handover_posts' }, (payload) => {
        const p = payload.new as HandoverPost;
        applyPost(p);
        void mergeAuthorProfiles([p.author_id]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'handover_posts' }, (payload) => {
        applyPost(payload.new as HandoverPost);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'handover_posts' }, (payload) => {
        const old = payload.old as { id?: string };
        if (old?.id) setPosts(prev => prev.filter(x => x.id !== old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'handover_comments' }, (payload) => {
        const c = payload.new as HandoverComment;
        setComments(prev => ({ ...prev, [c.post_id]: [...(prev[c.post_id] || []), c] }));
        void mergeAuthorProfiles([c.author_id]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'handover_comments' }, (payload) => {
        const old = payload.old as { id?: string };
        if (!old?.id) return;
        setComments(prev => {
          const next: Record<string, HandoverComment[]> = {};
          for (const [k, v] of Object.entries(prev)) next[k] = v.filter(x => x.id !== old.id);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mergeAuthorProfiles]);

  const pickPhoto = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('File harus berupa gambar.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Ukuran foto maksimal 5MB.');
      return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handlePost = async () => {
    const text = composer.trim();
    if (!text && !photoFile) {
      setError('Tulis sesuatu atau lampirkan foto dulu.');
      return;
    }
    setIsPosting(true);
    setError(null);
    try {
      let photoUrl: string | null = null;
      if (photoFile && userId) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('handover-photos').upload(path, photoFile);
        if (upErr) throw new Error(`Upload foto gagal: ${upErr.message}`);
        photoUrl = supabase.storage.from('handover-photos').getPublicUrl(path).data.publicUrl;
      }
      const { data: ins, error: insErr } = await supabase
        .from('handover_posts')
        .insert({
          author_id: userId,
          author_email: email,
          author_name: myName,
          content: text,
          photo_url: photoUrl,
          status: 'open',
        })
        .select('*')
        .single();
      if (insErr) throw new Error(insErr.message);
      if (ins) {
        setPosts(prev => [ins as HandoverPost, ...prev].slice(0, 50));
        void mergeAuthorProfiles([(ins as HandoverPost).author_id]);
      }
      setComposer('');
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (e: any) {
      setError(e?.message || 'Gagal posting.');
    } finally {
      setIsPosting(false);
    }
  };

  const toggleStatus = async (p: HandoverPost) => {
    setBusy(prev => ({ ...prev, [p.id]: true }));
    const next = p.status === 'open' ? 'done' : 'open';
    const { error: e } = await supabase
      .from('handover_posts')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (e) setError(`Gagal ubah status: ${e.message}`);
    else setPosts(prev => prev.map(x => (x.id === p.id ? { ...x, status: next } : x)));
    setBusy(prev => ({ ...prev, [p.id]: false }));
  };

  const deletePost = async (p: HandoverPost) => {
    if (!confirm('Hapus postingan ini beserta komentarnya?')) return;
    setBusy(prev => ({ ...prev, [p.id]: true }));
    try {
      if (p.photo_url) {
        const part = p.photo_url.split('/handover-photos/')[1];
        if (part) await supabase.storage.from('handover-photos').remove([decodeURIComponent(part)]);
      }
      const { error: e } = await supabase.from('handover_posts').delete().eq('id', p.id);
      if (e) throw new Error(e.message);
      setPosts(prev => prev.filter(x => x.id !== p.id));
    } catch (e: any) {
      setError(e?.message || 'Gagal hapus.');
    } finally {
      setBusy(prev => ({ ...prev, [p.id]: false }));
    }
  };

  const sendComment = async (postId: string) => {
    const text = (drafts[postId] || '').trim();
    if (!text) return;
    setBusy(prev => ({ ...prev, [`c-${postId}`]: true }));
    const { data: ins, error: e } = await supabase
      .from('handover_comments')
      .insert({
        post_id: postId,
        author_id: userId,
        author_email: email,
        author_name: myName,
        content: text,
      })
      .select('*')
      .single();
    if (e) {
      setError(`Gagal kirim komentar: ${e.message}`);
    } else {
      setDrafts(prev => ({ ...prev, [postId]: '' }));
      if (ins) {
        const c = ins as HandoverComment;
        setComments(prev => ({ ...prev, [c.post_id]: [...(prev[c.post_id] || []), c] }));
      }
    }
    setBusy(prev => ({ ...prev, [`c-${postId}`]: false }));
  };

  const deleteComment = async (c: HandoverComment) => {
    if (!confirm('Hapus komentar ini?')) return;
    const { error: e } = await supabase.from('handover_comments').delete().eq('id', c.id);
    if (e) setError(`Gagal hapus komentar: ${e.message}`);
    else setComments(prev => ({ ...prev, [c.post_id]: (prev[c.post_id] || []).filter(x => x.id !== c.id) }));
  };

  const filtered = useMemo(
    () => posts.filter(p => (filter === 'all' ? true : p.status === filter)),
    [posts, filter]
  );
  const openCount = posts.filter(p => p.status === 'open').length;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Home className="w-6 h-6 text-red-500" /> Beranda
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            serah terima pekerjaan mcc ↔ tenko
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-[10px] font-black uppercase">
              {openCount} belum selesai
            </span>
          )}
          <button
            type="button"
            onClick={() => { void load(); }}
            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-500 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-[11px] font-bold text-rose-600 dark:text-rose-300 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Composer ── */}
      {canPost ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {myAvatar ? (
              <img src={myAvatar} alt={myName} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-slate-400" />
              </div>
            )}
            <textarea
              value={composer}
              onChange={e => setComposer(e.target.value)}
              placeholder="Serah terima shift... (cth: RIT 3 JBK delay, unit B 1234 trouble, lanjutkan monitoring)"
              rows={3}
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-red-500/20 outline-none resize-none text-slate-800 dark:text-slate-100"
            />
          </div>
          {photoPreview && (
            <div className="relative mt-3 rounded-2xl overflow-hidden">
              <img src={photoPreview} alt="Lampiran" className="w-full max-h-72 object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                className="absolute top-2 right-2 p-1.5 rounded-xl bg-slate-900/70 text-white hover:bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-emerald-500" /> Foto
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => { void handlePost(); }}
              disabled={isPosting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 shadow-lg shadow-red-500/20"
            >
              {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isPosting ? 'Posting...' : 'Posting'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm text-[11px] font-bold text-slate-400">
          Hanya akun MCC, Tenko, dan Owner yang bisa posting. Akun lain bisa baca + komentar.
        </div>
      )}

      {/* ── Filter ── */}
      <div className="flex items-center gap-2">
        {(['all', 'open', 'done'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === f
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow'
                : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'open' ? 'Belum selesai' : 'Selesai'}
          </button>
        ))}
      </div>

      {/* ── Feed ── */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[0, 1].map(i => (
            <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800/50 rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-xs font-bold text-slate-400">
          Belum ada serah terima di sini.
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {filtered.map(p => {
            const badge = shiftBadge(p.author_email);
            const list = comments[p.id] || [];
            const showC = !!openComments[p.id];
            const mine = userId && p.author_id === userId;
            const prof = p.author_id ? authorProfiles[p.author_id] : undefined;
            const displayName = prof?.name || p.author_name || p.author_email?.split('@')[0] || 'User';
            const displayAvatar = prof?.avatar || null;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm"
              >
                <div className="p-4 flex items-center gap-3">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt={displayName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">{timeAgo(p.created_at)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${badge.cls}`}>{badge.label}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${p.status === 'open' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                    {p.status === 'open' ? 'Belum selesai' : 'Selesai'}
                  </span>
                </div>

                <div className="px-4 pb-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{p.content}</p>
                </div>
                {p.photo_url && (
                  <a href={p.photo_url} target="_blank" rel="noreferrer" className="block">
                    <img src={p.photo_url} alt="Lampiran serah terima" className="w-full max-h-96 object-cover" />
                  </a>
                )}

                <div className="px-4 py-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOpenComments(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {list.length > 0 ? `${list.length} komentar` : 'Komentar'}
                  </button>
                  {(mine || canPostHandover(email)) && (
                    <button
                      type="button"
                      onClick={() => { void toggleStatus(p); }}
                      disabled={!!busy[p.id]}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-colors disabled:opacity-50 ${
                        p.status === 'open'
                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                          : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                      }`}
                    >
                      {p.status === 'open' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {p.status === 'open' ? 'Tandai selesai' : 'Buka lagi'}
                    </button>
                  )}
                  {(mine || isOwnerUser(email)) && (
                    <button
                      type="button"
                      onClick={() => { void deletePost(p); }}
                      disabled={!!busy[p.id]}
                      title="Hapus postingan"
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    >
                      {!!busy[p.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  )}
                </div>

                {showC && (
                  <div className="px-4 pb-4 space-y-2 bg-slate-50/60 dark:bg-slate-800/30 pt-3">
                    {list.map(c => {
                      const cb = shiftBadge(c.author_email);
                      const cMine = userId && c.author_id === userId;
                      const cProf = c.author_id ? authorProfiles[c.author_id] : undefined;
                      const cName = cProf?.name || c.author_name || c.author_email?.split('@')[0] || 'User';
                      const cAvatar = cProf?.avatar || null;
                      return (
                        <div key={c.id} className="flex items-start gap-2 group">
                          {cAvatar ? (
                            <img src={cAvatar} alt={cName} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl px-3 py-2 min-w-0">
                            <p className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                              {cName}
                              <span className={`ml-1.5 px-1.5 py-px rounded text-[8px] font-black uppercase ${cb.cls}`}>{cb.label}</span>
                            </p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 break-words mt-0.5">{c.content}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">{timeAgo(c.created_at)}</p>
                          </div>
                          {(cMine || isOwnerUser(email)) && (
                            <button
                              type="button"
                              onClick={() => { void deleteComment(c); }}
                              title="Hapus komentar"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2">
                      <input
                        value={drafts[p.id] || ''}
                        onChange={e => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') void sendComment(p.id); }}
                        placeholder="Tulis komentar..."
                        className="flex-1 bg-white dark:bg-slate-800 border-0 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-red-500/20 outline-none text-slate-700 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => { void sendComment(p.id); }}
                        disabled={!!busy[`c-${p.id}`]}
                        className="p-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {!!busy[`c-${p.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
