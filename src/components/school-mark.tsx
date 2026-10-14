import { siteConfig } from "@/lib/site";

// Logo resmi bila URL-nya disediakan (Profil Sekolah di CMS atau
// NEXT_PUBLIC_SCHOOL_LOGO_URL); jika tidak, monogram netral yang jelas BUKAN
// logo resmi sekolah.
export function SchoolMark({ size = 40, tone = "dark", logoUrl }: { size?: number; tone?: "dark" | "light"; logoUrl?: string | null }) {
  const src = logoUrl ?? siteConfig.logoUrl;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={`Logo ${siteConfig.name}`} width={size} height={size} style={{ width: size, height: size }} className="object-contain" />
    );
  }
  const initials = siteConfig.shortName
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .map((w) => (/^\d+$/.test(w) ? w : w[0]))
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tracking-tight ring-1 ${
        tone === "dark" ? "bg-navy-900 text-gold-400 ring-navy-800" : "bg-white/10 text-gold-400 ring-white/20"
      }`}
    >
      {initials}
    </span>
  );
}
