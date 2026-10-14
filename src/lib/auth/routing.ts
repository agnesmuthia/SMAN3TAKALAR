import type { AccountStatus, UserRole } from "./types";

export type ProfileState = {
  role: UserRole | null;
  status: AccountStatus;
  hasOpenVerificationRequest: boolean;
} | null;

const ROLE_HOME: Record<UserRole, string> = {
  guru: "/dashboard/guru",
  siswa: "/dashboard/siswa",
  guru_bk: "/dashboard/bk",
  admin: "/admin",
};

// Area yang dikunci per peran. Path yang tidak tercantum di sini boleh
// diakses oleh semua akun aktif.
const ROLE_AREAS: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/dashboard/guru", roles: ["guru"] },
  { prefix: "/dashboard/siswa", roles: ["siswa"] },
  { prefix: "/dashboard/bk", roles: ["guru_bk"] },
];

export function homeForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

export function canAccessPath(role: UserRole, path: string): boolean {
  const area = ROLE_AREAS.find((a) => matchesPrefix(path, a.prefix));
  return area ? area.roles.includes(role) : true;
}

// Tujuan setelah login/callback. Login (termasuk Google) hanya membuktikan
// identitas; akses privat ditentukan status & peran dari database.
export function resolvePostLoginDestination(profile: ProfileState, next: string | null): string {
  if (!profile) return "/akun/lengkapi-profil";
  if (profile.status === "disabled") return "/masuk?error=akun_nonaktif";
  if (profile.status === "pending" || !profile.role) {
    return profile.hasOpenVerificationRequest ? "/akun/menunggu" : "/akun/lengkapi-profil";
  }
  if (next && next !== "/dashboard" && canAccessPath(profile.role, next)) {
    return next;
  }
  return homeForRole(profile.role);
}
