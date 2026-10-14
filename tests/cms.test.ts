import { describe, expect, it } from "vitest";
import { htmlToText, legacyTextToHtml, sanitizeNewsHtml, storageImagePrefix } from "@/lib/cms/sanitize";
import { detectImageType, validateImage, MAX_IMAGE_BYTES } from "@/lib/cms/image";
import { allowedIntents, displayStatus, targetStatus } from "@/lib/cms/workflow";
import { parseTagInput } from "@/lib/cms/tags";

const PREFIX = storageImagePrefix("https://abc.supabase.co")!;
const clean = (html: string) => sanitizeNewsHtml(html, { imagePrefix: PREFIX });

describe("sanitizeNewsHtml", () => {
  it("mempertahankan format yang diizinkan", () => {
    const html = "<h2>Judul</h2><p><strong>Tebal</strong> <em>miring</em></p><ul><li>satu</li></ul><blockquote>kutip</blockquote>";
    expect(clean(html)).toBe(html);
  });

  it("membuang script, style, iframe, dan atribut event", () => {
    const out = clean('<p onclick="x()">a</p><script>alert(1)</script><style>p{}</style><iframe src="https://x.test"></iframe><img src="x" onerror="alert(1)">');
    expect(out).toBe("<p>a</p>");
  });

  it("menetralkan tautan javascript: dan data:", () => {
    expect(clean('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(clean('<a href="data:text/html,<script>">x</a>')).toBe("<a>x</a>");
    expect(clean('<a href="//evil.test">x</a>')).toBe("<a>x</a>");
  });

  it("tautan eksternal dibuka di tab baru dengan rel aman", () => {
    expect(clean('<a href="https://contoh.test" onclick="x">x</a>')).toBe(
      '<a href="https://contoh.test" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
    expect(clean('<a href="mailto:a@b.test">m</a>')).toBe('<a href="mailto:a@b.test">m</a>');
  });

  it("hanya mengizinkan gambar dari Storage sekolah", () => {
    expect(clean(`<img src="${PREFIX}2026/10/a.jpg" alt="Foto">`)).toBe(`<img src="${PREFIX}2026/10/a.jpg" alt="Foto" />`);
    expect(clean('<img src="https://pelacak.test/pixel.gif">')).toBe("");
    expect(clean(`<img src="http://abc.supabase.co/storage/v1/object/public/news-images/a.jpg">`)).toBe("");
    expect(sanitizeNewsHtml(`<img src="${PREFIX}a.jpg">`, { imagePrefix: null })).toBe("");
  });

  it("menurunkan h1 menjadi h2", () => {
    expect(clean("<h1>Besar</h1>")).toBe("<h2>Besar</h2>");
  });
});

describe("htmlToText", () => {
  it("menghasilkan teks polos dengan pemisah paragraf", () => {
    expect(htmlToText("<h2>Judul</h2><p>Satu &amp; dua</p><ul><li>a</li><li>b</li></ul>")).toBe("Judul\n\nSatu & dua\n\na\n\nb");
  });
});

describe("validasi gambar", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  it("mengenali JPG, PNG, WebP dari isi file", () => {
    expect(detectImageType(jpeg)?.ext).toBe("jpg");
    expect(detectImageType(png)?.ext).toBe("png");
    expect(detectImageType(webp)?.ext).toBe("webp");
  });
  it("menolak file lain walau namanya .jpg", () => {
    expect(validateImage(new TextEncoder().encode("<svg onload=alert(1)>")).ok).toBe(false);
    expect(validateImage(new TextEncoder().encode("%PDF-1.7")).ok).toBe(false);
    expect(validateImage(new Uint8Array()).ok).toBe(false);
  });
  it("menolak file lebih dari 5 MB", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(jpeg);
    expect(validateImage(big)).toEqual({ ok: false, error: "Ukuran gambar maksimal 5 MB." });
  });
});

describe("alur status berita", () => {
  const editor = { canWrite: true, canPublish: false };
  const publisher = { canWrite: true, canPublish: true };
  const none = { canWrite: false, canPublish: false };

  it("editor hanya menyimpan & mengirim untuk persetujuan", () => {
    expect(allowedIntents(editor, null, true)).toEqual(["save", "submit"]);
    expect(allowedIntents(editor, "draft", true)).toEqual(["save", "submit"]);
    expect(allowedIntents(editor, "review", true)).toEqual(["save"]);
    expect(allowedIntents(editor, "published", true)).toEqual([]);
    expect(allowedIntents(editor, "draft", false)).toEqual([]);
  });

  it("penerbit dapat menerbitkan, mengembalikan, mengarsipkan, memulihkan", () => {
    expect(allowedIntents(publisher, "review", false)).toContain("publish");
    expect(allowedIntents(publisher, "review", false)).toContain("return");
    expect(allowedIntents(publisher, "published", false)).toEqual(["save", "archive"]);
    expect(allowedIntents(publisher, "archived", false)).toEqual(["restore"]);
    expect(allowedIntents(publisher, null, true)).not.toContain("archive");
  });

  it("tanpa izin tidak ada tindakan", () => {
    expect(allowedIntents(none, null, true)).toEqual([]);
  });

  it("status tujuan", () => {
    expect(targetStatus("submit", "draft")).toBe("review");
    expect(targetStatus("return", "review")).toBe("draft");
    expect(targetStatus("restore", "archived")).toBe("draft");
    expect(targetStatus("save", "published")).toBe("published");
    expect(targetStatus("save", null)).toBe("draft");
  });

  it("berita terbit dengan tanggal mendatang ditampilkan sebagai Terjadwal", () => {
    const now = new Date("2026-10-14T00:00:00Z");
    expect(displayStatus("published", "2026-10-15T00:00:00Z", now)).toBe("scheduled");
    expect(displayStatus("published", "2026-10-13T00:00:00Z", now)).toBe("published");
    expect(displayStatus("review", null, now)).toBe("review");
  });
});

describe("parseTagInput", () => {
  it("membersihkan, menghapus duplikat, dan membatasi jumlah", () => {
    expect(parseTagInput("Lomba,  Sains , lomba, a")).toEqual([
      { name: "Lomba", slug: "lomba" },
      { name: "Sains", slug: "sains" },
    ]);
    expect(parseTagInput(Array.from({ length: 20 }, (_, i) => `tag ${i}`).join(","))).toHaveLength(10);
    expect(parseTagInput("")).toEqual([]);
  });
});

describe("legacyTextToHtml", () => {
  it("mengubah teks lama menjadi paragraf HTML yang di-escape", () => {
    expect(legacyTextToHtml("Satu <b>\nbaris\n\nDua & tiga")).toBe("<p>Satu &lt;b&gt;<br>baris</p><p>Dua &amp; tiga</p>");
  });
});
