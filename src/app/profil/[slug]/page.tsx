import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { ContactCard } from "@/components/contact-card";
import { getPublishedPage, listPublishedPages } from "@/lib/content/public";
import { getSiteProfile } from "@/lib/content/site-profile";
import { formatTanggal } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/profil/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Halaman tidak ditemukan" };
  return { title: page.title, description: page.summary || undefined, alternates: { canonical: `/profil/${page.slug}` } };
}

export default async function ProfilDetailPage({ params }: PageProps<"/profil/[slug]">) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  const [pages, profile] = await Promise.all([listPublishedPages(), getSiteProfile()]);
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-12">
      <article className="lg:col-span-8">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-teal-700">Beranda</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/profil" className="hover:text-teal-700">Profil</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-slate-700">{page.title}</li>
          </ol>
        </nav>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{page.title}</h1>
        {page.summary && <p className="mt-3 text-lg text-slate-600">{page.summary}</p>}
        <div className="mt-8">
          <ArticleBody html={page.content_html} text={page.content} />
        </div>
        <p className="mt-10 text-xs text-slate-500">Diperbarui {formatTanggal(page.updated_at)}</p>
      </article>
      <aside className="space-y-4 lg:col-span-4">
        {pages.length > 1 && (
          <nav aria-label="Halaman profil" className="card">
            <h2 className="font-semibold text-navy-900">Profil sekolah</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/profil/${p.slug}`}
                    aria-current={p.slug === page.slug ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 ${p.slug === page.slug ? "bg-navy-900 font-semibold text-white" : "text-slate-700 hover:bg-surface"}`}
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <ContactCard profile={profile} />
      </aside>
    </div>
  );
}
