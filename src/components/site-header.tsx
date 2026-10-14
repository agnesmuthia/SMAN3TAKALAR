import Link from "next/link";
import { getAuthContext } from "@/lib/auth/dal";
import { homeForRole } from "@/lib/auth/routing";
import { siteConfig } from "@/lib/site";

export async function SiteHeader() {
  const ctx = await getAuthContext();
  const signedIn = Boolean(ctx?.user);
  const role = ctx?.profile?.status === "active" ? ctx.profile.role : null;
  const accountHref = role ? homeForRole(role) : "/akun";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          {siteConfig.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={siteConfig.logoUrl} alt={`Logo ${siteConfig.name}`} width={40} height={40} className="h-10 w-10" />
          ) : (
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-accent-400">
              S3
            </span>
          )}
          <span className="text-base font-bold text-brand-900 sm:text-lg">{siteConfig.name}</span>
        </Link>
        <nav aria-label="Navigasi utama" className="flex items-center gap-1 text-sm font-medium">
          <Link href="/" className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100">Beranda</Link>
          <Link href="/berita" className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100">Berita</Link>
          {signedIn ? (
            <>
              <Link href={accountHref} className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100">
                {role ? "Dashboard" : "Akun"}
              </Link>
              <form action="/auth/keluar" method="post">
                <button type="submit" className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100">Keluar</button>
              </form>
            </>
          ) : (
            <Link href="/masuk" className="btn-primary ml-1">Masuk</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
