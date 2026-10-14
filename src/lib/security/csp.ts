// Content-Security-Policy dengan nonce per permintaan (panduan Next.js 16).
// Skrip hanya boleh dari situs ini dengan nonce yang benar; gaya inline
// diizinkan karena atribut style tidak dapat diberi nonce dan risikonya rendah.

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, options: { dev: boolean; supabaseUrl?: string }): string {
  const supabase = origin(options.supabaseUrl);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(options.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Gambar dari Storage Supabase & logo https resmi.
    "img-src": ["'self'", "data:", "blob:", "https:", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'"],
    // Klien Supabase di browser (login Google, penautan akun).
    "connect-src": ["'self'", ...(supabase ? [supabase] : []), ...(options.dev ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!options.dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
