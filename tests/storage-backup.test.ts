import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backupBuckets, contentTypeFor, restoreFiles, safeJoin, verifyBackup } from "../scripts/lib/storage-backup.mjs";

// Klien Storage tiruan di memori (struktur folder seperti Supabase).
function fakeClient(initial: Record<string, Record<string, string>>) {
  const store = structuredClone(initial);
  return {
    store,
    storage: {
      from(bucket: string) {
        const files = (store[bucket] ??= {});
        return {
          async list(prefix: string, { limit, offset }: { limit: number; offset: number }) {
            const base = prefix ? `${prefix}/` : "";
            const names = new Map<string, boolean>();
            for (const path of Object.keys(files).filter((p) => p.startsWith(base))) {
              const rest = path.slice(base.length);
              const [head, ...tail] = rest.split("/");
              names.set(head, tail.length === 0);
            }
            const entries = [...names].sort().map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null }));
            return { data: entries.slice(offset, offset + limit), error: null };
          },
          async download(path: string) {
            return path in files ? { data: new Blob([files[path]]), error: null } : { data: null, error: { message: "tidak ada" } };
          },
          async upload(path: string, body: Buffer) {
            if (path in files) return { error: { message: "The resource already exists", statusCode: "409" } };
            files[path] = body.toString();
            return { error: null };
          },
        };
      },
    },
  };
}

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))); });

describe("backup Storage", () => {
  it("mengunduh semua file termasuk subfolder, lalu memulihkan tanpa menimpa", async () => {
    const source = fakeClient({
      "site-media": { "2026/10/a.jpg": "gambar-a", "2026/11/b.png": "gambar-b" },
      documents: { "sk/2026/07/c.pdf": "%PDF-isi" },
    });
    const dir = await mkdtemp(join(tmpdir(), "cadangan-")); dirs.push(dir);
    const manifest = await backupBuckets(source, ["site-media", "documents", "news-images"], dir);
    expect(manifest.buckets).toEqual({ "site-media": 2, documents: 1, "news-images": 0 });
    expect(await readFile(join(dir, "documents/sk/2026/07/c.pdf"), "utf8")).toBe("%PDF-isi");

    const verified = await verifyBackup(dir);
    expect(verified.problems).toEqual([]);

    const target = fakeClient({ "site-media": { "2026/10/a.jpg": "VERSI-TUJUAN" } });
    const result = await restoreFiles(target, dir, verified.manifest);
    expect(result).toEqual({ uploaded: 2, skipped: 1, failed: [] });
    expect(target.store["site-media"]["2026/10/a.jpg"]).toBe("VERSI-TUJUAN"); // tidak ditimpa
    expect(target.store.documents["sk/2026/07/c.pdf"]).toBe("%PDF-isi");
  });

  it("mendeteksi file backup yang berubah/hilang", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cadangan-")); dirs.push(dir);
    await backupBuckets(fakeClient({ "site-media": { "x.jpg": "asli", "y.jpg": "asli" } }), ["site-media"], dir);
    await writeFile(join(dir, "site-media/x.jpg"), "diubah");
    await rm(join(dir, "site-media/y.jpg"));
    const { problems } = await verifyBackup(dir);
    expect(problems).toHaveLength(2);
  });

  it("menolak jalur yang keluar dari folder backup", () => {
    expect(() => safeJoin("/tmp/cadangan", "documents", "../../etc/passwd")).toThrow();
    expect(safeJoin("/tmp/cadangan", "documents", "sk/a.pdf")).toBe("/tmp/cadangan/documents/sk/a.pdf");
  });

  it("jenis konten dari ekstensi", () => {
    expect(contentTypeFor("a/b.PDF")).toBe("application/pdf");
    expect(contentTypeFor("a.webp")).toBe("image/webp");
    expect(contentTypeFor("tanpa-ekstensi")).toBe("application/octet-stream");
  });
});
