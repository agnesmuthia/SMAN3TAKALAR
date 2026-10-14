// Utilitas murni untuk portal berita (dapat diuji tanpa database).

const WORDS_PER_MINUTE = 200;

export function readingMinutes(...texts: (string | null | undefined)[]): number {
  const words = texts.join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// Kata kunci pencarian dibersihkan: dipangkas, dibatasi panjangnya, dan
// karakter wildcard/pemisah filter PostgREST dinetralkan.
export function normalizeSearch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[%_\\,()*"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parsePage(raw: unknown): number {
  const n = Number(typeof raw === "string" ? raw : "1");
  return Number.isInteger(n) && n > 0 && n <= 10_000 ? n : 1;
}

export function pageHref(base: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "" && !(key === "halaman" && value === 1)) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function paragraphs(content: string): string[] {
  return content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

// Jendela data portal berita. Halaman pertama tanpa pencarian menampilkan
// 1 berita utama + `pageSize` berita di grid; halaman berikutnya hanya grid.
export function newsPageWindow(page: number, hasSearch: boolean, pageSize: number) {
  if (hasSearch) return { offset: (page - 1) * pageSize, limit: pageSize, withFeatured: false };
  if (page === 1) return { offset: 0, limit: pageSize + 1, withFeatured: true };
  return { offset: (page - 1) * pageSize + 1, limit: pageSize, withFeatured: false };
}

export function newsLastPage(total: number, hasSearch: boolean, pageSize: number): number {
  const gridTotal = hasSearch ? total : Math.max(0, total - 1);
  return Math.max(1, Math.ceil(gridTotal / pageSize));
}
