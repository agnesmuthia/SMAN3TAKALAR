export type UserRole = "guru" | "siswa" | "guru_bk" | "admin";
export type AccountStatus = "pending" | "active" | "disabled";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole | null;
  status: AccountStatus;
  profile_completed_at: string | null;
  verified_at: string | null;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  guru: "Guru",
  siswa: "Siswa",
  guru_bk: "Guru BK",
  admin: "Admin",
};

export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: "Menunggu verifikasi",
  active: "Aktif",
  disabled: "Nonaktif",
};
