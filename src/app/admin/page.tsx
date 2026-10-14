import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { requireAdminArea } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { formatWaktuWita } from "@/lib/cms/time";
import { getEmailProviderStatus } from "@/lib/newsletter/service";

export const metadata: Metadata = { title: "Admin" };

// Semua angka berasal dari database (dibatasi RLS sesuai peran), bukan contoh.
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const ctx = await requireAdminArea("/admin");
  const sp = await searchParams;
  const db = ctx.supabase;
  const nowIso = new Date().toISOString();
  const head = { count: "exact" as const, head: true };

  const [published, scheduled, review, drafts, returned, upcoming] = await Promise.all([
    db.from("news").select("id", head).eq("status", "published").lte("published_at", nowIso),
    db.from("news").select("id", head).eq("status", "published").gt("published_at", nowIso),
    db.from("news").select("id", head).eq("status", "review"),
    db.from("news").select("id", head).eq("status", "draft"),
    db.from("news").select("id", head).eq("status", "draft").not("review_note", "is", null),
    db.from("news").select("id, title, published_at").eq("status", "published").gt("published_at", nowIso).order("published_at").limit(5),
  ]);

  const newsStats = [
    { label: "Berita terbit", value: published.count ?? 0, href: "/admin/berita?status=published" },
    { label: "Menunggu persetujuan", value: review.count ?? 0, href: "/admin/berita?status=review" },
    { label: "Terjadwal", value: scheduled.count ?? 0, href: "/admin/berita?status=scheduled" },
    { label: ctx.access.canPublish ? "Draf" : "Draf saya", value: drafts.count ?? 0, href: "/admin/berita?status=draft" },
  ];

  const actions: { text: string; href: string }[] = [];
  if (ctx.access.canPublish && (review.count ?? 0) > 0) {
    actions.push({ text: `${review.count} berita menunggu persetujuan Anda.`, href: "/admin/berita?status=review" });
  }
  if ((returned.count ?? 0) > 0) {
    actions.push({ text: `${returned.count} berita dikembalikan dengan catatan dan perlu diperbaiki.`, href: "/admin/berita?status=draft" });
  }

  let superStats: { label: string; value: number; href: string }[] = [];
  let providerWarning: string | null = null;
  if (ctx.access.isSuperAdmin) {
    const [verif, active, pending, campaigns] = await Promise.all([
      db.from("verification_requests").select("id", head).eq("status", "submitted"),
      db.from("newsletter_subscribers").select("id", head).eq("status", "active"),
      db.from("newsletter_subscribers").select("id", head).eq("status", "pending"),
      db.from("newsletter_campaigns").select("id", head).eq("status", "draft"),
    ]);
    superStats = [
      { label: "Verifikasi menunggu", value: verif.count ?? 0, href: "/admin/verifikasi" },
      { label: "Pelanggan aktif", value: active.count ?? 0, href: "/admin/langganan" },
      { label: "Pelanggan belum konfirmasi", value: pending.count ?? 0, href: "/admin/langganan?status=pending" },
      { label: "Draf kampanye", value: campaigns.count ?? 0, href: "/admin/langganan/kampanye" },
    ];
    if ((verif.count ?? 0) > 0) actions.push({ text: `${verif.count} akun menunggu verifikasi peran.`, href: "/admin/verifikasi" });
    const provider = getEmailProviderStatus();
    if (!provider.configured) providerWarning = provider.reason;
  }

  const upcomingRows = (upcoming.data ?? []) as { id: string; title: string; published_at: string }[];
  const error = authErrorMessage(sp.error);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Ringkasan</h1>
          <p className="text-sm text-slate-600">
            Peran: {ctx.access.isSuperAdmin ? "Super Admin" : ctx.access.canPublish ? "Admin Website" : "Editor"}
          </p>
        </div>
        <Link href="/admin/berita/baru" className="btn-primary">+ Tambah Berita</Link>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {providerWarning && (
        <Alert tone="warning">Penyedia email belum aktif: {providerWarning} Lihat docs/langganan-berita-email.md.</Alert>
      )}

      {actions.length > 0 && (
        <section className="card border-l-4 !border-l-gold-500">
          <h2 className="font-semibold text-navy-900">Perlu tindakan</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {actions.map((a) => (
              <li key={a.href + a.text}><Link href={a.href} className="text-teal-700 hover:underline">{a.text}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-navy-900">Berita</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newsStats.map((s) => (
            <Link key={s.label} href={s.href} className="card card-hover">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-bold text-navy-900">{s.value}</p>
            </Link>
          ))}
        </div>
      </section>

      {upcomingRows.length > 0 && (
        <section className="card">
          <h2 className="font-semibold text-navy-900">Jadwal publikasi</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {upcomingRows.map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
                <Link href={`/admin/berita/${n.id}`} className="font-medium text-teal-700 hover:underline">{n.title}</Link>
                <span className="text-slate-500">{formatWaktuWita(n.published_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {superStats.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-navy-900">Akun & langganan</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {superStats.map((s) => (
              <Link key={s.label} href={s.href} className="card card-hover">
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-navy-900">{s.value}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
