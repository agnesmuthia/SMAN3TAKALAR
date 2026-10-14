import Link from "next/link";
import { PORTAL_BUKU_URL, siteConfig } from "@/lib/site";
import { SchoolMark } from "./school-mark";
import { SubscribeForm } from "./subscribe-form";

export function SiteFooter() {
  const { address, phone, email } = siteConfig.contact;
  const hasContact = Boolean(address || phone || email);

  return (
    <footer className="mt-20 bg-navy-950 text-slate-300">
      <div className="h-1 bg-gradient-to-r from-teal-600 via-gold-500 to-teal-600" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3">
            <SchoolMark tone="light" />
            <p className="text-lg font-bold text-white">{siteConfig.name}</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{siteConfig.description}</p>
          {hasContact && (
            <address className="mt-5 space-y-1.5 text-sm not-italic">
              {address && <p>{address}</p>}
              {phone && <p>Telepon: <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">{phone}</a></p>}
              {email && <p>Email: <a href={`mailto:${email}`} className="hover:text-white">{email}</a></p>}
            </address>
          )}
        </div>
        <div className="lg:col-span-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-400">Jelajahi</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/berita" className="hover:text-white">Berita</Link></li>
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
