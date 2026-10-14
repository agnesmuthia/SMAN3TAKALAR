import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePdf } from "./pdf";

// Bucket PRIVAT untuk SK & PDF perpustakaan. Service role hanya dipakai di
// server SETELAH hak akses diperiksa (pengelola untuk unggah; RLS tabel untuk unduh).
export const DOCUMENTS_BUCKET = "documents";

type Folder = "sk" | "perpustakaan";

export async function uploadPdf(folder: Folder, file: File): Promise<{ ok: true; path: string; size: number } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pilih file PDF." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validatePdf(bytes);
  if (!check.ok) return check;
  const now = new Date();
  const path = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.pdf`;
  const { error } = await createAdminClient().storage.from(DOCUMENTS_BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    console.error("[dokumen] unggah gagal:", error.message);
    return { ok: false, error: "PDF gagal diunggah. Periksa koneksi lalu coba lagi." };
  }
  return { ok: true, path, size: bytes.length };
}

// Tautan sementara (60 detik). Panggil hanya setelah baris dokumen terbukti
// dapat dibaca pengguna lewat RLS.
export async function signedPdfUrl(path: string, downloadName?: string): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient()
      .storage.from(DOCUMENTS_BUCKET)
      .createSignedUrl(path, 60, downloadName ? { download: downloadName } : undefined);
    if (error || !data) {
      console.error("[dokumen] tautan sementara gagal:", error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (error) {
    console.error("[dokumen] tautan sementara gagal:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function removePdf(path: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) console.error("[dokumen] hapus file gagal:", error.message);
}

export function safeFileName(base: string): string {
  const cleaned = base.normalize("NFKD").replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
  return `${cleaned || "dokumen"}.pdf`;
}
