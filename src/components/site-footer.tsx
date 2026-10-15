import Link from "next/link";
import { getSiteProfile } from "@/lib/content/site-profile";
import { PORTAL_BUKU_URL, siteConfig } from "@/lib/site";
import { SchoolMark } from "./school-mark";
import { SubscribeForm } from "./subscribe-form";

const EXPLORE = [
  { href: "/profil", label: "Profil sekolah" },
  { href: "/berita", label: "Berita" },
  { href: "/pengumuman", label: "Pengumuman" },
  { href: "/galeri", label: "Galeri" },
  { href: "/prestasi", label: "Prestasi" },
  { href: "/kalender", label: "Kalender kegiatan" },
  { href: "/ruang-rasa", label: "Ruang Rasa (lapor perundungan)" },
  { href: "/perpustakaan", label: "Perpustakaan digital" },
  { href: "/dokumen", label: "Arsip SK" },
];

export async function SiteFooter() {
  const profile = await getSiteProfile();
  const { address, phone, email, whatsapp, maps_url } = profile;
  const hasContact = Boolean(address || phone || email || whatsapp || maps_url);
  // Hanya akun resmi yang diisi admin di Profil Sekolah.
  const socials = [
    { label: "Instagram", href: profile.instagram_url },
    { label: "Facebook", href: profile.facebook_url },
    { label: "YouTube", href: profile.youtube_url },
    { label: "TikTok", href: profile.tiktok_url },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  return (
    <footer className="mt-20 bg-navy-950 text-slate-300">
      <div className="h-1 bg-gradient-to-r from-teal-600 via-gold-500 to-teal-600" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3">
            <SchoolMark tone="light" logoUrl={profile.logo_url} />
            <p className="text-lg font-bold text-white">{siteConfig.name}</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{siteConfig.description}</p>
          {hasContact && (
            <address className="mt-5 space-y-1.5 text-sm not-italic">
              {address && <p>{address}</p>}
              {phone && <p>Telepon: <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">{phone}</a></p>}
              {whatsapp && <p>WhatsApp: <a href={`https://wa.me/${whatsapp.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">{whatsapp}</a></p>}
              {email && <p>Email: <a href={`mailto:${email}`} className="hover:text-white">{email}</a></p>}
              {maps_url && <p><a href={maps_url} target="_blank" rel="noopener noreferrer" className="hover:text-white">Lihat lokasi di peta ↗</a></p>}
            </address>
          )}
          {socials.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold" aria-label="Media sosial resmi">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full bg-white/10 px-3 py-1.5 text-slate-200 ring-1 ring-white/15 transition hover:bg-white/20">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lg:col-span-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-400">Jelajahi</p>
          <ul className="mt-4 space-y-2 text-sm">
            {EXPLORE.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>)}
            <li><a href={PORTAL_BUKU_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">Portal Buku Kemendikdasmen ↗</a></li>
            <li><Link href="/masuk" className="hover:text-white">Masuk warga sekolah</Link></li>
            <li><Link href="/kebijakan-privasi" className="hover:text-white">Kebijakan Privasi</Link></li>
          </ul>
        </div>
        <div className="footer-subscribe lg:col-span-5">
          <SubscribeForm source="footer" variant="dark" />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {siteConfig.name}</p>
          <p>Berita dapat dibaca tanpa login.</p>
        </div>
      </div>
    </footer>
  );
}
