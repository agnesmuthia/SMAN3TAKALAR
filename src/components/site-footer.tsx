import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { SubscribeForm } from "./subscribe-form";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand-900 text-slate-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2">
        <div>
          <p className="text-lg font-bold text-white">{siteConfig.name}</p>
          <p className="mt-2 max-w-sm text-sm text-slate-300">{siteConfig.description}</p>
          <ul className="mt-4 space-y-1 text-sm">
            <li><Link href="/berita" className="hover:underline">Berita</Link></li>
            <li><Link href="/kebijakan-privasi" className="hover:underline">Kebijakan Privasi</Link></li>
            <li><Link href="/masuk" className="hover:underline">Masuk warga sekolah</Link></li>
          </ul>
        </div>
        <SubscribeForm source="footer" variant="dark" />
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {siteConfig.name}
      </div>
    </footer>
  );
}
