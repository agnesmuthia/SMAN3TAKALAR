import type { UserRole } from "@/lib/auth/types";

export type NavItem = { href: string; label: string };

export const DASHBOARD_NAV: Record<Exclude<UserRole, "admin">, NavItem[]> = {
  guru: [
    { href: "/dashboard/guru", label: "Ringkasan" },
    { href: "/dashboard/guru/jadwal", label: "Jadwal mengajar" },
    { href: "/dashboard/guru/tugas", label: "Tugas & materi" },
    { href: "/dashboard/pengumuman", label: "Pengumuman" },
  ],
  siswa: [
    { href: "/dashboard/siswa", label: "Ringkasan" },
    { href: "/dashboard/siswa/jadwal", label: "Jadwal" },
    { href: "/dashboard/siswa/tugas", label: "Tugas & materi" },
    { href: "/dashboard/pengumuman", label: "Pengumuman" },
  ],
  guru_bk: [
    { href: "/dashboard/bk", label: "Ringkasan" },
    { href: "/dashboard/pengumuman", label: "Pengumuman" },
  ],
};
