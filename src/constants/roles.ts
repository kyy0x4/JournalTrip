// Role & akses berdasarkan email user — dipusatkan di sini biar gampang diubah
// tanpa harus nyari-nyari di kode.
//
// Hirarki:
//   owner  (kyyaspi13@gmail.com)  — akses penuh + Kelola User
//   admin  (kmdimcc@gmail.com)    — bisa edit (evaluasi cancel, evidence tensi, admin foto)
//   TAM    (toyotaastra@kmdi.co.id) — view TAM, hide menu internal (kr-report, kr-loading, drivers, carbon)
//   user   (opsmonitoring & lainnya) — view standar, hide Admin Foto

export const OWNER_EMAIL = 'kyyaspi13@gmail.com';
export const ADMIN_EMAIL = 'kmdimcc@gmail.com';
export const TAM_EMAIL = 'toyotaastra@kmdi.co.id';

export const isOwnerUser = (email?: string | null) => email === OWNER_EMAIL;
export const isAdminUser = (email?: string | null) => email === ADMIN_EMAIL || isOwnerUser(email);
export const isTAMUser = (email?: string | null) => email === TAM_EMAIL;

// Bisa edit data operasional (fleet evaluasi cancel, evidence tensi, dst).
// Owner selalu bisa; admin bisa; user biasa (opsmonitoring, TAM) tidak.
export const canEdit = (email?: string | null) => isAdminUser(email);

export type RoleLabel = 'Owner' | 'Admin' | 'TAM' | 'User';
export const getRoleLabel = (email?: string | null): RoleLabel => {
  if (isOwnerUser(email)) return 'Owner';
  if (email === ADMIN_EMAIL) return 'Admin';
  if (isTAMUser(email)) return 'TAM';
  return 'User';
};
