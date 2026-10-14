import Link from "next/link";
import { requireAdminArea, type StaffAccess } from "@/lib/auth/dal";

type Need = "super" | "publish" | "write";
const NAV: { href: string; label: string; need: Need }[] = [
  { href: "/admin", label: "Ringkasan", need: "write" },
  { href: "/admin/berita", label: "Berita", need: "write" },
  { href: "/admin/pengumuman", label: "Pengumuman", need: "publish" },
  { href: "/admin/halaman", label: "Halaman", need: "publish" },
  { href: "/admin/program", label: "Program", need: "publish" },
  { href: "/admin/galeri", label: "Galeri", need: "publish" },
  { href: "/admin/prestasi", label: "Prestasi", need: "publish" },
  { href: "/admin/kalender", label: "Kalender", need: "publish" },
  { href: "/admin/profil-sekolah", label: "Profil Sekolah", need: "publish" },
  { href: "/admin/verifikasi", label: "Verifikasi", need: "super" },
  { href: "/admin/pengguna", label: "Pengguna", need: "super" },
  { href: "/admin/jadwal", label: "Jadwal", need: "super" },
  { href: "/admin/langganan", label: "Langganan Berita", need: "super" },
  { href: "/admin/pengaturan", label: "Pengaturan", need: "super" },
];

function allowed(need: Need, access: StaffAccess): boolean {
  if (need === "super") return access.isSuperAdmin;
  if (need === "publish") return access.canPublish;
  return access.canWrite;
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Lapisan tambahan; setiap halaman & server action admin memeriksa izinnya sendiri.
  const { access } = await requireAdminArea("/admin");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Navigasi admin" className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 pb-3 text-sm">
        {NAV.filter((item) => allowed(item.need, access)).map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white hover:text-navy-900">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
