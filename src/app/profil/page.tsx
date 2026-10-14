import type { Metadata } from "next";
import Link from "next/link";
import { ContactCard } from "@/components/contact-card";
import { EmptyState, PageHero } from "@/components/page-hero";
import { listPrograms, listPublishedPages } from "@/lib/content/public";
import { getSiteProfile } from "@/lib/content/site-profile";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Profil Sekolah",
  description: `Profil, visi dan misi, serta informasi resmi ${siteConfig.name}.`,
};

export default async function ProfilPage() {
  const [pages, programs, profile] = await Promise.all([listPublishedPages(), listPrograms(), getSiteProfile()]);
  return (
    <div>
      <PageHero eyebrow="Tentang kami" title="Profil sekolah" description={`Informasi resmi tentang ${siteConfig.name}.`} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {pages.length === 0 ? (
            <EmptyState title="Halaman profil belum tersedia." text="Informasi profil sekolah akan tampil di sini setelah diterbitkan pengelola website." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link href={`/profil/${p.slug}`} className="card card-hover block h-full">
                    <h2 className="font-bold text-navy-900">{p.title}</h2>
                    {p.summary && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{p.summary}</p>}
                    <span className="mt-3 inline-block text-sm font-semibold text-teal-700">Baca <span aria-hidden>→</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {programs.length > 0 && (
            <section className="pt-6" aria-labelledby="judul-program">
              <h2 id="judul-program" className="section-title">Program unggulan</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {programs.map((p) => (
                  <li key={p.id} className="card">
                    <h3 className="font-semibold text-navy-900">{p.page ? <Link href={`/profil/${p.page.slug}`} className="hover:underline">{p.title}</Link> : p.title}</h3>
                    {p.summary && <p className="mt-1 text-sm text-slate-600">{p.summary}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <ContactCard profile={profile} />
        </aside>
      </div>
    </div>
  );
}
