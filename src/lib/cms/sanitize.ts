import sanitizeHtml from "sanitize-html";

// Sanitasi HTML isi berita. Dipanggil saat MENYIMPAN dan lagi saat
// MENAMPILKAN (pertahanan berlapis bila data diubah di luar aplikasi).
//
// Diizinkan: heading h2–h4, paragraf, penekanan, daftar, kutipan, garis,
// tautan (http/https/mailto), dan gambar HANYA dari Storage sekolah.
// Dibuang: script, style, iframe, atribut event (onerror, onclick, ...),
// javascript:/data: URL, gambar dari luar (pelacak/hotlink).

export type SanitizeOptions = {
  // Awalan URL publik bucket gambar, mis.
  // https://<ref>.supabase.co/storage/v1/object/public/news-images/
  imagePrefix: string | null;
};

export function sanitizeNewsHtml(html: string, opts: SanitizeOptions): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "a", "img", "hr"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    // Heading h1 milik judul halaman; turunkan menjadi h2.
    transformTags: {
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//i.test(href);
        return {
          tagName: "a",
          attribs: {
            href,
            ...(attribs.title ? { title: attribs.title } : {}),
            ...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
          },
        };
      },
    },
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs.src ?? "";
      return !opts.imagePrefix || !src.startsWith(opts.imagePrefix);
    },
  });
}

// Versi teks polos untuk pencarian, estimasi waktu baca, dan ringkasan.
export function htmlToText(html: string): string {
  const withBreaks = (html ?? "")
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function storageImagePrefix(supabaseUrl: string | undefined | null, bucket = "news-images"): string | null {
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/`;
}

// Berita lama (sebelum CMS) disimpan sebagai teks dengan paragraf dipisah
// baris kosong. Diubah menjadi HTML aman untuk editor dan tampilan.
export function legacyTextToHtml(text: string): string {
  return (text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}
