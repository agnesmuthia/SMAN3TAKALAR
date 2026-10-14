// Validasi PDF dari isi file (magic bytes), bukan dari nama/MIME kiriman browser.

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Pemeriksaan sederhana atas penanda aksi berbahaya yang tidak terkompresi.
// Ini BUKAN antivirus; hanya menolak pola yang jelas tidak dibutuhkan dokumen SK.
const RISKY_MARKERS = ["/JavaScript", "/Launch"];

export function validatePdf(bytes: Uint8Array): { ok: true } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "File kosong." };
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, error: "Ukuran PDF maksimal 10 MB." };
  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (head !== "%PDF-") return { ok: false, error: "File harus berformat PDF." };
  const text = new TextDecoder("latin1").decode(bytes);
  const marker = RISKY_MARKERS.find((m) => text.includes(m));
  if (marker) return { ok: false, error: "PDF memuat skrip/aksi otomatis dan ditolak. Simpan ulang sebagai PDF biasa (Cetak → Simpan sebagai PDF)." };
  return { ok: true };
}
