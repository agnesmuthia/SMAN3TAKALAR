import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { getEmailProviderStatus } from "@/lib/newsletter/service";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const ctx = await requireRole(["admin"], "/admin");
  const sp = await searchParams;
  const db = ctx.supabase;

  const [verif, active, pending, campaigns] = await Promise.all([
    db.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("newsletter_campaigns").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  const provider = getEmailProviderStatus();
  const error = authErrorMessage(sp.error);

  const stats = [
    { label: "Verifikasi menunggu", value: verif.count ?? 0, href: "/admin/verifikasi" },
    { label: "Pelanggan aktif", value: active.count ?? 0, href: "/admin/langganan" },
    { label: "Pelanggan belum konfirmasi", value: pending.count ?? 0, href: "/admin/langganan?status=pending" },
    { label: "Draf kampanye", value: campaigns.count ?? 0, href: "/admin/langganan/kampanye" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Ringkasan admin</h1>
      {error && <Alert tone="error">{error}</Alert>}
      {!provider.configured && (
        <Alert tone="warning">
          Penyedia email belum aktif: {provider.reason} Formulir langganan menampilkan pesan &quot;belum aktif&quot; dan
          buletin tidak dapat dikirim sampai konfigurasi selesai (lihat docs/langganan-berita-email.md).
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-brand-600">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-brand-900">{s.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
