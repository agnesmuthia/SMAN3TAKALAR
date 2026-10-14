import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageImagePrefix } from "./sanitize";
import { validateImage } from "./image";

export const NEWS_IMAGE_BUCKET = "news-images";

export function newsImagePrefix(): string | null {
  return storageImagePrefix(process.env.NEXT_PUBLIC_SUPABASE_URL, NEWS_IMAGE_BUCKET);
}

// Mengunggah gambar berita. WAJIB dipanggil setelah pemeriksaan can_write_news
// (service role melewati RLS). Nama file acak; nama asli tidak disimpan.
export async function uploadNewsImage(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pilih file gambar." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateImage(bytes);
  if (!check.ok) return check;

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${check.kind.ext}`;
  const storage = createAdminClient().storage.from(NEWS_IMAGE_BUCKET);
  const { error } = await storage.upload(path, bytes, { contentType: check.kind.mime, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[cms] unggah gambar gagal:", error.message);
    return { ok: false, error: "Gambar gagal diunggah. Periksa koneksi lalu coba lagi." };
  }
  const { data } = storage.getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
