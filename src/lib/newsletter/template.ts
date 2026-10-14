// Template email berbasis tabel + inline style agar kompatibel dengan
// berbagai klien email (Gmail, Outlook, aplikasi ponsel).
//
// PENTING: template hanya menerima tipe NewsletterArticle yang dibentuk
// eksplisit dari kolom berita publik (judul, ringkasan, gambar, tanggal,
// tautan). Isi lengkap berita, data siswa, atau data lain tidak pernah
// diteruskan ke sini.

export type NewsletterArticle = {
  title: string;
  excerpt: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
};

export type NewsletterSite = {
  name: string;
  url: string;
  logoUrl: string | null;
  timeZone: string;
};

export type NewsletterTemplateSettings = {
  heading: string;
  intro: string;
  footerNote: string;
  accentColor: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeLink(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "#";
  } catch {
    return "#";
  }
}

function safeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1d4ed8";
}

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone }).format(new Date(iso));
}

// Membentuk artikel buletin dari baris berita: HANYA kolom yang diizinkan.
export function toNewsletterArticle(
  news: {
    slug: string;
    title: string;
    excerpt: string;
    cover_image_url: string | null;
    published_at: string | null;
  },
  siteUrl: string,
): NewsletterArticle {
  return {
    title: news.title,
    excerpt: news.excerpt,
    url: `${siteUrl}/berita/${encodeURIComponent(news.slug)}`,
    imageUrl: safeHttpsUrl(news.cover_image_url),
    publishedAt: news.published_at ?? new Date().toISOString(),
  };
}

function layout(opts: {
  site: NewsletterSite;
  accent: string;
  preheader: string;
  body: string;
  footer: string;
}): string {
  const { site, accent } = opts;
  const logo = safeHttpsUrl(site.logoUrl);
  const siteUrl = safeLink(site.url);
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(site.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
<tr><td style="padding:24px;border-bottom:4px solid ${accent};font-family:Arial,Helvetica,sans-serif;">
${logo ? `<img src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(site.name)}" width="56" height="56" style="display:block;border:0;margin-bottom:8px;">` : ""}
<a href="${escapeHtml(siteUrl)}" style="font-size:20px;font-weight:bold;color:#0f172a;text-decoration:none;">${escapeHtml(site.name)}</a>
</td></tr>
${opts.body}
<tr><td style="padding:20px 24px;background:#f8fafc;border-radius:0 0 8px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b;">
${opts.footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderNewsletterEmail(input: {
  site: NewsletterSite;
  template: NewsletterTemplateSettings;
  subject: string;
  heading?: string | null;
  intro?: string | null;
  articles: NewsletterArticle[];
  unsubscribeUrl: string;
}): RenderedEmail {
  const { site, template } = input;
  const accent = safeColor(template.accentColor);
  const heading = input.heading || template.heading;
  const intro = input.intro || template.intro;
  const siteUrl = safeLink(site.url);
  const unsubscribeUrl = safeLink(input.unsubscribeUrl);

  const articlesHtml = input.articles
    .map((a) => {
      const link = escapeHtml(safeLink(a.url));
      const image = safeHttpsUrl(a.imageUrl);
      return `<tr><td style="padding:0 24px 24px;font-family:Arial,Helvetica,sans-serif;">
${image ? `<a href="${link}"><img src="${escapeHtml(image)}" alt="" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:6px;margin-bottom:12px;"></a>` : ""}
<p style="margin:0 0 4px;font-size:12px;color:#64748b;">${escapeHtml(formatDate(a.publishedAt, site.timeZone))}</p>
<h2 style="margin:0 0 8px;font-size:18px;line-height:24px;color:#0f172a;"><a href="${link}" style="color:#0f172a;text-decoration:none;">${escapeHtml(a.title)}</a></h2>
${a.excerpt ? `<p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#334155;">${escapeHtml(a.excerpt)}</p>` : ""}
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:${accent};border-radius:6px;">
<a href="${link}" style="display:inline-block;padding:10px 16px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Baca berita selengkapnya</a>
</td></tr></table>
</td></tr>`;
    })
    .join("\n");

  const body = `<tr><td style="padding:24px 24px 8px;font-family:Arial,Helvetica,sans-serif;">
<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#0f172a;">${escapeHtml(heading)}</h1>
${intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#334155;">${escapeHtml(intro)}</p>` : ""}
</td></tr>
${articlesHtml}`;

  const footer = `${template.footerNote ? `<p style="margin:0 0 8px;">${escapeHtml(template.footerNote)}</p>` : ""}
<p style="margin:0 0 8px;">Kunjungi <a href="${escapeHtml(siteUrl)}" style="color:${accent};">${escapeHtml(site.name)}</a> untuk berita lainnya.</p>
<p style="margin:0;">Tidak ingin menerima email ini lagi? <a href="${escapeHtml(unsubscribeUrl)}" style="color:${accent};">Berhenti berlangganan</a>. Anda tidak perlu masuk ke akun website.</p>`;

  const text = [
    site.name,
    "",
    heading,
    intro,
    "",
    ...input.articles.flatMap((a) => [
      `${a.title} (${formatDate(a.publishedAt, site.timeZone)})`,
      a.excerpt,
      `Baca berita selengkapnya: ${safeLink(a.url)}`,
      "",
    ]),
    template.footerNote,
    `Website sekolah: ${siteUrl}`,
    `Berhenti berlangganan: ${unsubscribeUrl}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return {
    subject: input.subject,
    html: layout({ site, accent, preheader: input.articles[0]?.title ?? heading, body, footer }),
    text,
  };
}

export function renderConfirmationEmail(input: {
  site: NewsletterSite;
  confirmUrl: string;
  ttlHours: number;
}): RenderedEmail {
  const accent = "#1d4ed8";
  const confirmUrl = escapeHtml(safeLink(input.confirmUrl));
  const body = `<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:28px;color:#0f172a;">Konfirmasi langganan berita</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#334155;">Kami menerima permintaan untuk mengirim berita terbaru ${escapeHtml(input.site.name)} ke alamat email ini. Klik tombol di bawah untuk mengonfirmasi.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:${accent};border-radius:6px;">
<a href="${confirmUrl}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Konfirmasi langganan</a>
</td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#64748b;">Tautan berlaku ${input.ttlHours} jam dan hanya dapat dipakai sekali. Jika Anda tidak merasa mendaftar, abaikan email ini; Anda tidak akan menerima buletin.</p>
</td></tr>`;
  const footer = `<p style="margin:0;">Email ini dikirim satu kali karena ada permintaan langganan melalui website ${escapeHtml(input.site.name)}.</p>`;
  return {
    subject: `Konfirmasi langganan berita ${input.site.name}`,
    html: layout({ site: input.site, accent, preheader: "Konfirmasi langganan berita sekolah", body, footer }),
    text: [
      "Konfirmasi langganan berita",
      "",
      `Kami menerima permintaan untuk mengirim berita terbaru ${input.site.name} ke alamat email ini.`,
      `Buka tautan berikut untuk mengonfirmasi (berlaku ${input.ttlHours} jam, sekali pakai):`,
      safeLink(input.confirmUrl),
      "",
      "Jika Anda tidak merasa mendaftar, abaikan email ini.",
    ].join("\n"),
  };
}
