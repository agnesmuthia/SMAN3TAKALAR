// Validasi tujuan redirect setelah login untuk mencegah open redirect.
// Hanya path internal relatif yang diterima; URL absolut, protocol-relative
// (//evil.com), backslash, dan karakter kontrol ditolak.

const INTERNAL_ORIGIN = "http://internal.invalid";

export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL_ORIGIN) return fallback;
  // Normalisasi dot-segment dapat mengubah "/..//host" menjadi "//host".
  if (url.pathname.startsWith("//")) return fallback;
  // Hindari loop ke endpoint autentikasi.
  if (url.pathname.startsWith("/auth/")) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
