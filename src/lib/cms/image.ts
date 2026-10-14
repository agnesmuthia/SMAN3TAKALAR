// Deteksi jenis gambar dari "magic bytes", bukan dari nama file atau MIME
// yang dikirim browser (keduanya dapat dipalsukan).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

export function detectImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export function validateImage(bytes: Uint8Array): { ok: true; kind: ImageKind } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "File kosong." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "Ukuran gambar maksimal 5 MB." };
  const kind = detectImageType(bytes);
  if (!kind) return { ok: false, error: "Format gambar harus JPG, PNG, atau WebP." };
  return { ok: true, kind };
}
