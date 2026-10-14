import Link from "next/link";
import { requireAdminArea, type StaffAccess } from "@/lib/auth/dal";

type Need = "super" | "publish" | "write" | "school" | "library";
const GROUPS: { label: string; items: { href: string; label: string; need: Need }[] }[] = [
  {
    label: "Konten",
    items: [
      { href: "/admin/berita", label: "Berita", need: "write" },
      { href: "/admin/pengumuman", label: "Pengumuman", need: "publish" },
      { href: "/admin/halaman", label: "Halaman", need: "publish" },
      { href: "/admin/program", label: "Program", need: "publish" },
      { href: "/admin/galeri", label: "Galeri", need: "publish" },
      { href: "/admin/prestasi", label: "Prestasi", need: "publish" },
      { href: "/admin/kalender", label: "Kalender", need: "publish" },
      { href: "/admin/perpustakaan", label: "Perpustakaan", need: "library" },
      { href: "/admin/profil-sekolah", label: "Profil Sekolah", need: "publish" },
    ],
  },
  {
    label: "Administrasi",
    items: [
      { href: "/admin/tahun-ajaran", label: "Tahun Ajaran", need: "school" },
      { href: "/admin/jadwal", label: "Jadwal", need: "school" },
      { href: "/admin/arsip-sk", label: "Arsip SK", need: "school" },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/admin/verifikasi", label: "Verifikasi", need: "super" },
      { href: "/admin/pengguna", label: "Pengguna", need: "super" },
      { href: "/admin/langganan", label: "Langganan Berita", need: "super" },
      { href: "/admin/pengaturan", label: "Pengaturan", need: "super" },
      { href: "/admin/status", label: "Status Sistem", need: "super" },
      { href: "/admin/log", label: "Log Aktivitas", need: "super" },
    ],
  },
];

function allowed(need: Need, access: StaffAccess): boolean {
  if (need === "super") return access.isSuperAdmin;
  if (need === "publish") return access.canPublish;
  if (need === "school") return access.canManageSchool;
  if (need === "library") return access.canManageLibrary;
  return access.canWrite;
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Lapisan tambahan; setiap halaman & server action admin memeriksa izinnya sendiri.
  const { access } = await requireAdminArea("/admin");
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.need, access)) })).filter((g) => g.items.length > 0);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Navigasi admin" className="mb-6 space-y-1 border-b border-slate-200 pb-3 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <Link href="/admin" className="rounded-lg px-3 py-1.5 font-semibold text-navy-900 transition hover:bg-white">Ringkasan</Link>
        </div>
        {groups.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1">
            <span className="w-28 shrink-0 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</span>
            {g.items.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white hover:text-navy-900">
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {children}
    </div>
  );
}
