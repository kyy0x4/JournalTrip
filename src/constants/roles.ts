// Role & akses berdasarkan email user — dipusatkan di sini biar gampang diubah
// tanpa harus nyari-nyari di kode.
//
// Hirarki:
//   owner  (kyyaspi13@gmail.com)  — akses penuh + Kelola User
//   admin  (kmdimcc@gmail.com)    — MCC shift + bisa edit (evaluasi cancel, evidence tensi, admin foto)
//   tenko  (tenkokmdi@gmail.com)  — shift Tenko, posting serah terima
//   TAM    (toyotaastra@kmdi.co.id) — view TAM, hide menu internal (kr-report, kr-loading, drivers, carbon)
//   user   (opsmonitoring & lainnya) — view standar, hide Admin Foto

export const OWNER_EMAIL = 'kyyaspi13@gmail.com';
export const ADMIN_EMAIL = 'kmdimcc@gmail.com';
export const TENKO_EMAIL = 'tenkokmdi@gmail.com';
export const TAM_EMAIL = 'toyotaastra@kmdi.co.id';
// Akun checker lapangan — satu-satunya yang boleh isi P2H. Ganti dengan email aslinya.
export const CHECKER_EMAIL = 'checker@kmdi.co.id';

export const isOwnerUser = (email?: string | null) => email === OWNER_EMAIL;
export const isAdminUser = (email?: string | null) => email === ADMIN_EMAIL || isOwnerUser(email);
export const isTAMUser = (email?: string | null) => email === TAM_EMAIL;
export const isTenkoUser = (email?: string | null) => email === TENKO_EMAIL;
export const isCheckerUser = (email?: string | null) => email === CHECKER_EMAIL;

// Bisa edit data operasional (fleet evaluasi cancel, evidence tensi, faktor tensi, dst).
// Owner + admin (MCC) + tenko — sesuai guard DB di migration lockdown.
// User biasa (opsmonitoring, TAM) read-only.
export const canEdit = (email?: string | null) =>
  isAdminUser(email) || isTenkoUser(email);

// Bisa isi P2H: hanya akun checker lapangan + 3 editor (owner/admin/tenko).
// Akun lain (opsmonitoring, TAM) read-only.
export const canFillP2H = (email?: string | null) =>
  isCheckerUser(email) || isAdminUser(email) || isTenkoUser(email);

// Boleh posting serah terima di Beranda: owner + admin (mcc) + tenko.
export const canPostHandover = (email?: string | null) =>
  isOwnerUser(email) || isAdminUser(email) || isTenkoUser(email);

export type RoleLabel = 'Owner' | 'Admin' | 'Tenko' | 'TAM' | 'Checker' | 'User';
export const getRoleLabel = (email?: string | null): RoleLabel => {
  if (isOwnerUser(email)) return 'Owner';
  if (isTenkoUser(email)) return 'Tenko';
  if (email === ADMIN_EMAIL) return 'Admin';
  if (isTAMUser(email)) return 'TAM';
  if (isCheckerUser(email)) return 'Checker';
  return 'User';
};
