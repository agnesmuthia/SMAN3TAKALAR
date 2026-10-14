#!/usr/bin/env node
// Backup ISI file Supabase Storage (gambar & PDF). Backup database Supabase
// tidak menyertakan file Storage, jadi skrip ini wajib dijalankan bersama
// scripts/backup-db.sh.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
//   BACKUP_PASSPHRASE=… node scripts/backup-storage.mjs [folder-tujuan]
//
// Hasil: backups/storage-<waktu>.tar.gz.enc (+ .sha256). Folder sementara yang
// tidak terenkripsi dihapus setelah dienkripsi.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_BUCKETS, backupBuckets } from "./lib/storage-backup.mjs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
if (!process.env.BACKUP_PASSPHRASE && process.env.BACKUP_ALLOW_PLAINTEXT !== "1") {
  console.error("BACKUP_PASSPHRASE belum diisi. File SK bersifat privat; backup wajib dienkripsi.");
  process.exit(2);
}

const outRoot = resolve(process.argv[2] ?? "./backups");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const name = `storage-${stamp}`;
const work = await mkdtemp(join(tmpdir(), "cadangan-storage-"));
try {
  const dir = join(work, name);
  await mkdir(dir, { recursive: true });
  const buckets = (process.env.BACKUP_BUCKETS ?? DEFAULT_BUCKETS.join(",")).split(",").map((b) => b.trim()).filter(Boolean);
  console.log(`→ Mengunduh file dari ${buckets.length} bucket…`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const manifest = await backupBuckets(client, buckets, dir, console.log);

  await mkdir(outRoot, { recursive: true });
  execFileSync("tar", ["-C", work, "-czf", join(work, `${name}.tar.gz`), name]);
  let final;
  if (process.env.BACKUP_PASSPHRASE) {
    final = join(outRoot, `${name}.tar.gz.enc`);
    execFileSync("openssl", ["enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-salt", "-pass", "env:BACKUP_PASSPHRASE",
      "-in", join(work, `${name}.tar.gz`), "-out", final]);
  } else {
    final = join(outRoot, `${name}.tar.gz`);
    await writeFile(final, await readFile(join(work, `${name}.tar.gz`)));
    console.warn("PERINGATAN: backup Storage TIDAK terenkripsi (BACKUP_ALLOW_PLAINTEXT=1).");
  }
  const digest = createHash("sha256").update(await readFile(final)).digest("hex");
  await writeFile(`${final}.sha256`, `${digest}  ${basename(final)}\n`);
  const total = manifest.files.reduce((s, f) => s + f.size, 0);
  console.log(`✓ Backup Storage selesai: ${final}`);
  console.log(`  ${manifest.files.length} file, ${(total / 1024 / 1024).toFixed(1)} MB.`);
} finally {
  await rm(work, { recursive: true, force: true });
}
