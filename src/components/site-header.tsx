import Link from "next/link";
import { getAuthContext, getStaffAccess } from "@/lib/auth/dal";
import { homeForRole } from "@/lib/auth/routing";
import { getSiteProfile } from "@/lib/content/site-profile";
import { siteConfig } from "@/lib/site";
import { SchoolMark } from "./school-mark";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/profil", label: "Profil" },
  { href: "/berita", label: "Berita" },
  { href: "/pengumuman", label: "Pengumuman" },
  { href: "/galeri", label: "Galeri" },
  { href: "/prestasi", label: "Prestasi" },
  { href: "/kalender", label: "Kalender" },
];

export async function SiteHeader() {
  const [ctx, profile] = await Promise.all([getAuthContext(), getSiteProfile()]);
  const signedIn = Boolean(ctx?.user);
  const role = ctx?.profile?.status === "active" ? ctx.profile.role : null;
  const accountHref = role ? homeForRole(role) : "/akun";
  const accountLabel = role ? "Dashboard" : "Akun";
  // Guru yang juga Editor/Admin Website mendapat pintasan ke CMS.
  const access = signedIn ? await getStaffAccess() : null;
  const showCms = Boolean(access?.canWrite && role !== "admin");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <SchoolMark logoUrl={profile.logo_url} />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight text-navy-900 sm:text-lg">{siteConfig.name}</span>
            <span className="hidden text-xs text-slate-500 sm:block">Website resmi sekolah</span>
          </span>
        </Link>

        {/* Desktop */}
        <nav aria-label="Navigasi utama" className="hidden items-center gap-0.5 text-sm font-medium lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-2.5 py-2 text-slate-700 transition hover:bg-surface hover:text-navy-900">
              {item.label}
            </Link>
          ))}
          {signedIn ? (
            <>
              {showCms && <Link href="/admin" className="rounded-lg px-2.5 py-2 text-slate-700 transition hover:bg-surface hover:text-navy-900">CMS</Link>}
              <Link href={accountHref} className="rounded-lg px-2.5 py-2 text-slate-700 transition hover:bg-surface hover:text-navy-900">{accountLabel}</Link>
              <form action="/auth/keluar" method="post">
                <button type="submit" className="rounded-lg px-2.5 py-2 text-slate-700 transition hover:bg-surface hover:text-navy-900">Keluar</button>
              </form>
            </>
          ) : (
            <Link href="/masuk" className="btn-primary ml-2">Masuk</Link>
          )}
        </nav>

        {/* Ponsel: menu tanpa JavaScript */}
        <details className="group relative lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" className="group-open:hidden" />
              <path d="M6 6l12 12M18 6L6 18" className="hidden group-open:block" />
            </svg>
            Menu
          </summary>
          <nav aria-label="Navigasi utama (ponsel)" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface">{item.label}</Link>
            ))}
            <div className="my-2 h-px bg-slate-100" />
            {signedIn ? (
              <>
                {showCms && <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface">CMS</Link>}
                <Link href={accountHref} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface">{accountLabel}</Link>
                <form action="/auth/keluar" method="post">
                  <button type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-surface">Keluar</button>
                </form>
              </>
            ) : (
              <Link href="/masuk" className="btn-primary w-full">Masuk</Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
