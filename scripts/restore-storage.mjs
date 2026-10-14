#!/usr/bin/env node
// Memulihkan ISI file Storage dari backup-storage.mjs ke proyek TUJUAN.
// File yang sudah ada di tujuan TIDAK ditimpa (hanya file yang hilang yang diunggah).
//
//   RESTORE_SUPABASE_URL=https://<ref-uji>.supabase.co RESTORE_SUPABASE_SERVICE_ROLE_KEY=… \
//   BACKUP_PASSPHRASE=… node scripts/restore-storage.mjs backups/storage-….tar.gz.enc
//
// Pengaman produksi sama dengan restore-db.sh: bila tujuan = SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_URL atau memuat PRODUCTION_PROJECT_REF, wajib --produksi
// dan konfirmasi ketik ulang di terminal.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { restoreFiles, verifyBackup } from "./lib/storage-backup.mjs";

const [file, ...flags] = process.argv.slice(2);
const target = process.env.RESTORE_SUPABASE_URL;
const key = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY;
if (!file || !target || !key) {
  console.error("Pemakaian: RESTORE_SUPABASE_URL=… RESTORE_SUPABASE_SERVICE_ROLE_KEY=… node scripts/restore-storage.mjs <file-backup> [--ya] [--produksi]");
  process.exit(2);
}

const production = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = process.env.PRODUCTION_PROJECT_REF;
const isProduction = (production && target.replace(/\/+$/, "") === production.replace(/\/+$/, "")) || (ref && target.includes(ref));
async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
}
if (isProduction) {
  if (!flags.includes("--produksi") || !process.stdin.isTTY) {
    console.error("DITOLAK: tujuan adalah Storage PRODUKSI. Gunakan proyek uji, atau --produksi secara interaktif dengan persetujuan tertulis sekolah.");
    process.exit(3);
  }
  const phrase = `PULIHKAN PRODUKSI ${ref ?? ""}`.trim();
  if ((await ask(`Ketik persis "${phrase}" untuk melanjutkan: `)) !== phrase) process.exit(3);
} else if (!flags.includes("--ya")) {
  if (!process.stdin.isTTY || (await ask("Unggah file yang belum ada ke proyek tujuan? (ketik ya): ")) !== "ya") process.exit(1);
}

const work = await mkdtemp(join(tmpdir(), "pulih-storage-"));
try {
  try {
    const expected = (await readFile(`${file}.sha256`, "utf8")).split(/\s+/)[0];
    const actual = createHash("sha256").update(await readFile(file)).digest("hex");
    if (expected !== actual) { console.error("Checksum file backup TIDAK cocok."); process.exit(4); }
    console.log("✓ Checksum file backup cocok.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let archive = file;
  if (file.endsWith(".enc")) {
    if (!process.env.BACKUP_PASSPHRASE) { console.error("Isi BACKUP_PASSPHRASE."); process.exit(2); }
    archive = join(work, "backup.tar.gz");
    try {
      execFileSync("openssl", ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-pass", "env:BACKUP_PASSPHRASE", "-in", file, "-out", archive], { stdio: "pipe" });
    } catch {
      console.error("Gagal membuka backup (frasa sandi salah atau file rusak)."); process.exit(4);
    }
  }
  execFileSync("tar", ["-C", work, "-xzf", archive]);
  const folder = (await readdir(work)).find((n) => n.startsWith("storage-"));
  if (!folder) { console.error("Isi backup tidak dikenali."); process.exit(4); }
  const dir = join(work, folder);
  const { manifest, problems } = await verifyBackup(dir);
  if (problems.length) { console.error(`Backup rusak (${problems.length} file):\n${problems.slice(0, 10).join("\n")}`); process.exit(4); }
  console.log(`✓ ${manifest.files.length} file utuh (backup ${manifest.created_utc}). Mengunggah ke ${new URL(target).host}…`);
  const client = createClient(target, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await restoreFiles(client, dir, manifest, console.log);
  if (result.failed.length) { console.error(result.failed.slice(0, 10).join("\n")); process.exit(6); }
  console.log("✓ Pemulihan Storage selesai.");
} finally {
  await rm(work, { recursive: true, force: true });
}
