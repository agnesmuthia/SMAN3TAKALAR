"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadGalleryPhotoAction } from "@/app/admin/konten/actions";

// Mengunggah foto satu per satu (setiap permintaan < batas ukuran server) dan
// menampilkan kemajuan serta foto yang gagal.
export function GalleryUploader({ albumId }: { albumId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onUpload() {
    const files = Array.from(inputRef.current?.files ?? []).slice(0, 50);
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress({ done: i, total: files.length });
      const fd = new FormData();
      fd.set("albumId", albumId);
      fd.set("file", file);
      try {
        const result = await uploadGalleryPhotoAction(fd);
        if (!result.ok) failed.push(`${file.name}: ${result.error}`);
      } catch {
        failed.push(`${file.name}: gagal terkirim (periksa ukuran ≤ 5 MB & koneksi).`);
      }
    }
    setProgress({ done: files.length, total: files.length });
    setErrors(failed);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label htmlFor="photos" className="label">Tambah foto (boleh pilih banyak sekaligus, maks. 50; JPG/PNG/WebP ≤ 5 MB per foto)</label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="photos"
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <button type="button" onClick={onUpload} disabled={busy} className="btn-primary">
          {busy ? "Mengunggah…" : "Unggah foto"}
        </button>
      </div>
      {progress && (
        <p role="status" className="text-sm text-slate-600">
          {busy ? `Mengunggah ${progress.done + 1} dari ${progress.total}…` : `Selesai: ${progress.total - errors.length} dari ${progress.total} foto terunggah.`}
        </p>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-red-700">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}
