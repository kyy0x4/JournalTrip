import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Image as ImageIcon, Trash2, UploadCloud, X, User,
  ShieldCheck, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  nik: string | null;
  area: string | null;
  avatar_url: string | null;
  coaching_photo_url: string | null;
}

const AREAS = ['ALL', 'AREA 1', 'AREA 2', 'AREA 3', 'AREA 4', 'AREA 5'];
const PAGE_SIZE = 20;

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'avatar' | 'coaching';
    driver: Driver | null;
  }>({ isOpen: false, type: 'avatar', driver: null });
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDrivers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, nik, area, avatar_url, coaching_photo_url')
      .order('name');

    if (!error && data) {
      setDrivers(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedArea]);

  const filteredDrivers = useMemo(() => {
    let result = drivers;
    if (selectedArea !== 'ALL') {
      result = result.filter(d => d.area === selectedArea);
    }
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(lower) ||
        (d.nik && d.nik.toLowerCase().includes(lower))
      );
    }
    return result;
  }, [drivers, search, selectedArea]);

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / PAGE_SIZE));
  const pagedDrivers = filteredDrivers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openModal = (driver: Driver, type: 'avatar' | 'coaching') => {
    setModalState({ isOpen: true, type, driver });
  };

  const closeModal = () => {
    if (!isUploading) {
      setModalState({ isOpen: false, type: 'avatar', driver: null });
    }
  };

  const handleDeletePhoto = async () => {
    if (!modalState.driver) return;
    const { driver, type } = modalState;
    const currentUrl = type === 'avatar' ? driver.avatar_url : driver.coaching_photo_url;
    if (!currentUrl) return;

    if (!confirm('Yakin ingin menghapus foto ini?')) return;

    setIsUploading(true);
    try {
      const bucket = type === 'avatar' ? 'driver-photos' : 'coaching-photos';
      const urlParts = currentUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      if (fileName) {
        await supabase.storage.from(bucket).remove([fileName]);
      }
      const column = type === 'avatar' ? 'avatar_url' : 'coaching_photo_url';
      const { error: dbError } = await supabase
        .from('drivers')
        .update({ [column]: null })
        .eq('id', driver.id);
      if (dbError) throw new Error(`DB update gagal: ${dbError.message} (code: ${dbError.code})`);
      await fetchDrivers();
      showToast('Foto berhasil dihapus!', 'success');
      closeModal();
    } catch (e) {
      console.error(e);
      showToast('Gagal menghapus foto.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!modalState.driver || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const { driver, type } = modalState;
    const bucket = type === 'avatar' ? 'driver-photos' : 'coaching-photos';
    const column = type === 'avatar' ? 'avatar_url' : 'coaching_photo_url';
    const currentUrl = type === 'avatar' ? driver.avatar_url : driver.coaching_photo_url;

    setIsUploading(true);
    try {
      if (currentUrl) {
        const urlParts = currentUrl.split('/');
        const oldFileName = urlParts[urlParts.length - 1];
        if (oldFileName) {
          await supabase.storage.from(bucket).remove([oldFileName]);
        }
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${driver.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const { error: dbError } = await supabase
        .from('drivers')
        .update({ [column]: publicUrlData.publicUrl })
        .eq('id', driver.id);
      if (dbError) throw new Error(`DB update gagal: ${dbError.message} (code: ${dbError.code})`);
      console.log('DB update sukses, URL:', publicUrlData.publicUrl);
      await fetchDrivers();
      showToast('Foto berhasil diupload!', 'success');
      closeModal();
    } catch (err: any) {
      console.error(err);
      showToast(`Gagal mengupload foto: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const photoUrl = modalState.driver
    ? (modalState.type === 'avatar' ? modalState.driver.avatar_url : modalState.driver.coaching_photo_url)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-20">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="sticky top-4 z-40 px-4 md:px-6">
        <div className="max-w-6xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-white/60 dark:border-slate-800 px-6 h-16 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <span className="font-black text-lg tracking-tight">Admin Area</span>
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg hidden sm:block">Manajemen Foto</span>
          </div>
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Cari driver / NIK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl pl-10 pr-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 mt-4 space-y-4">

        {/* ── Filter Area ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest">
            <Filter className="w-3.5 h-3.5" /> Area
          </div>
          {AREAS.map(area => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${selectedArea === area
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
            >
              {area}
            </button>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" /> Daftar Driver
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isLoading ? 'Memuat...' : `${filteredDrivers.length} driver${selectedArea !== 'ALL' ? ` di ${selectedArea}` : ''}`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4 w-8">#</th>
                  <th className="px-6 py-4">Driver</th>
                  <th className="px-6 py-4">Area</th>
                  <th className="px-6 py-4">Foto Profil</th>
                  <th className="px-6 py-4">Foto Coaching</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 w-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                      <td className="px-6 py-4">
                        <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                        <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                      </td>
                      <td className="px-6 py-4"><div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" /></td>
                      <td className="px-6 py-4"><div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" /></td>
                    </tr>
                  ))
                ) : pagedDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400 italic text-sm">
                      Tidak ada driver yang cocok.
                    </td>
                  </tr>
                ) : (
                  pagedDrivers.map((d, i) => (
                    <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-300 dark:text-slate-600">
                        {(currentPage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {d.avatar_url ? (
                            <img
                              src={d.avatar_url}
                              alt={d.name}
                              className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm shrink-0"
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=dbeafe&color=1d4ed8&size=64`; }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-black text-slate-900 dark:text-white leading-tight">{d.name}</p>
                            <p className="text-xs font-semibold text-slate-400">{d.nik || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${d.area ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>
                          {d.area || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openModal(d, 'avatar')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${d.avatar_url
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {d.avatar_url ? 'Edit' : 'Upload'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openModal(d, 'coaching')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${d.coaching_photo_url
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {d.coaching_photo_url ? 'Edit' : 'Upload'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {!isLoading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-400">
                Halaman <span className="text-slate-700 dark:text-slate-300">{currentPage}</span> dari <span className="text-slate-700 dark:text-slate-300">{totalPages}</span>
                &nbsp;· <span className="text-slate-700 dark:text-slate-300">{filteredDrivers.length}</span> driver
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-xs font-bold">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${currentPage === p
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modalState.isOpen && modalState.driver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-black text-lg">
                    {modalState.type === 'avatar' ? '📸 Foto Profil' : '🎓 Foto Coaching'}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">{modalState.driver.name} · {modalState.driver.area || 'No Area'}</p>
                </div>
                <button onClick={closeModal} disabled={isUploading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col items-center justify-center min-h-[220px] bg-slate-50 dark:bg-slate-950/50">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-slate-500 animate-pulse">Memproses foto...</p>
                  </div>
                ) : photoUrl ? (
                  <div className="rounded-2xl overflow-hidden shadow-lg border-4 border-white dark:border-slate-800">
                    <img
                      src={photoUrl}
                      alt="Foto"
                      className="max-h-[280px] object-cover"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(modalState.driver!.name)}&background=e2e8f0&color=475569&size=256`; }}
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold">Belum ada foto</p>
                    <p className="text-xs mt-1">Klik "Upload Foto" untuk menambahkan</p>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-900">
                {photoUrl && (
                  <button
                    onClick={handleDeletePhoto}
                    disabled={isUploading}
                    className="flex-1 flex justify-center items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus
                  </button>
                )}
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadPhoto}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
                    <UploadCloud className="w-4 h-4" />
                    {photoUrl ? 'Ganti Foto' : 'Upload Foto'}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
