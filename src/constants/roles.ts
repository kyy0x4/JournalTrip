// Role & akses berdasarkan email user — dipusatkan di sini biar gampang diubah
// tanpa harus nyari-nyari di kode.
export const ADMIN_EMAIL = 'kmdimcc@gmail.com';
export const TAM_EMAIL = 'toyotaastra@kmdi.co.id';

export const isAdminUser = (email?: string | null) => email === ADMIN_EMAIL;
export const isTAMUser = (email?: string | null) => email === TAM_EMAIL;
