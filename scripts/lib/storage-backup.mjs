// Logika backup/pulih isi file Supabase Storage. Klien disuntikkan agar dapat
// diuji tanpa jaringan. Dipakai oleh scripts/backup-storage.mjs dan
// scripts/restore-storage.mjs.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";

export const DEFAULT_BUCKETS = ["news-images", "site-media", "documents"];
const PAGE = 1000;

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
export function contentTypeFor(path) {
  return MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// Jalur file dari manifest tidak boleh keluar dari folder backup.
export function safeJoin(root, ...parts) {
  const target = normalize(join(root, ...parts));
  if (target !== normalize(root) && !target.startsWith(normalize(root) + sep)) throw new Error(`Jalur tidak aman: ${parts.join("/")}`);
  return target;
}

async function listAll(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Gagal membaca daftar file "${prefix}": ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folder dikembalikan tanpa id.
      if (entry.id === null || entry.id === undefined) files.push(...(await listAll(bucket, path)));
      else files.push(path);
    }
    if (!data || data.length < PAGE) break;
  }
  return files;
}

export async function backupBuckets(client, buckets, outDir, log = () => {}) {
  const manifest = { created_utc: new Date().toISOString(), buckets: {}, files: [] };
  for (const name of buckets) {
    const bucket = client.storage.from(name);
    const paths = await listAll(bucket);
    manifest.buckets[name] = paths.length;
    log(`  ${name}: ${paths.length} file`);
    for (const path of paths) {
      const { data, error } = await bucket.download(path);
      if (error || !data) throw new Error(`Gagal mengunduh ${name}/${path}: ${error?.message ?? "kosong"}`);
      const buffer = Buffer.from(await data.arrayBuffer());
      const target = safeJoin(outDir, name, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buffer);
      manifest.files.push({ bucket: name, path, size: buffer.length, sha256: sha256(buffer) });
    }
  }
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

// Memeriksa semua file cocok dengan manifest SEBELUM ada yang diunggah.
export async function verifyBackup(dir) {
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  const problems = [];
  for (const f of manifest.files) {
    try {
      const buffer = await readFile(safeJoin(dir, f.bucket, f.path));
      if (sha256(buffer) !== f.sha256) problems.push(`${f.bucket}/${f.path}: checksum berbeda`);
    } catch (error) {
      problems.push(`${f.bucket}/${f.path}: ${error instanceof Error ? error.message : "tidak terbaca"}`);
    }
  }
  return { manifest, problems };
}

// Mengunggah file yang belum ada di tujuan. File yang sudah ada TIDAK ditimpa.
export async function restoreFiles(client, dir, manifest, log = () => {}) {
  const result = { uploaded: 0, skipped: 0, failed: [] };
  for (const f of manifest.files) {
    const buffer = await readFile(safeJoin(dir, f.bucket, f.path));
    const { error } = await client.storage.from(f.bucket).upload(f.path, buffer, { contentType: contentTypeFor(f.path), upsert: false });
    if (!error) result.uploaded++;
    else if (/exists|duplicate|409/i.test(`${error.message} ${error.statusCode ?? ""}`)) result.skipped++;
    else result.failed.push(`${f.bucket}/${f.path}: ${error.message}`);
  }
  log(`  diunggah ${result.uploaded}, sudah ada ${result.skipped}, gagal ${result.failed.length}`);
  return result;
}
