import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";

const NAV = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/verifikasi", label: "Verifikasi" },
  { href: "/admin/pengguna", label: "Pengguna" },
  { href: "/admin/berita", label: "Berita" },
  { href: "/admin/pengumuman", label: "Pengumuman" },
  { href: "/admin/jadwal", label: "Jadwal" },
  { href: "/admin/langganan", label: "Langganan Berita" },
  { href: "/admin/pengaturan", label: "Pengaturan" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Lapisan tambahan; setiap halaman & server action admin juga memeriksa peran.
  await requireRole(["admin"], "/admin");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Navigasi admin" className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="rounded px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
