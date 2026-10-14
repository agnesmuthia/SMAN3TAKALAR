import { describe, expect, it } from "vitest";
import { newsLastPage, newsPageWindow, normalizeSearch, pageHref, paragraphs, parsePage, readingMinutes } from "@/lib/news-utils";

describe("portal berita", () => {
  it("menghitung estimasi waktu baca minimal 1 menit", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("kata ".repeat(600))).toBe(3);
    expect(readingMinutes("a b", null, "c")).toBe(1);
  });

  it("menetralkan karakter wildcard & pemisah filter pada pencarian", () => {
    expect(normalizeSearch("  lomba   sains ")).toBe("lomba sains");
    expect(normalizeSearch("100%_x")).toBe("100 x");
    expect(normalizeSearch("a,b),title.eq.x")).toBe("a b title.eq.x");
    expect(normalizeSearch("x".repeat(200))).toHaveLength(80);
    expect(normalizeSearch(["array"])).toBe("");
  });

  it("memvalidasi nomor halaman", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("membangun tautan halaman tanpa parameter kosong", () => {
    expect(pageHref("/berita", { q: "", halaman: 1 })).toBe("/berita");
    expect(pageHref("/berita", { q: "lomba sains", halaman: 2 })).toBe("/berita?q=lomba+sains&halaman=2");
  });

  it("memecah paragraf", () => {
    expect(paragraphs("satu\n\n\ndua\n\n  ")).toEqual(["satu", "dua"]);
  });
});


describe("pagination portal berita", () => {
  it("halaman 1 memuat berita utama + grid, halaman berikutnya tidak mengulang berita", () => {
    expect(newsPageWindow(1, false, 9)).toEqual({ offset: 0, limit: 10, withFeatured: true });
    expect(newsPageWindow(2, false, 9)).toEqual({ offset: 10, limit: 9, withFeatured: false });
    expect(newsPageWindow(3, false, 9)).toEqual({ offset: 19, limit: 9, withFeatured: false });
  });

  it("pencarian tanpa berita utama", () => {
    expect(newsPageWindow(1, true, 9)).toEqual({ offset: 0, limit: 9, withFeatured: false });
    expect(newsPageWindow(2, true, 9)).toEqual({ offset: 9, limit: 9, withFeatured: false });
  });

  it("menghitung halaman terakhir", () => {
    expect(newsLastPage(0, false, 9)).toBe(1);
    expect(newsLastPage(10, false, 9)).toBe(1);
    expect(newsLastPage(11, false, 9)).toBe(2);
    expect(newsLastPage(19, false, 9)).toBe(2);
    expect(newsLastPage(20, false, 9)).toBe(3);
    expect(newsLastPage(9, true, 9)).toBe(1);
    expect(newsLastPage(10, true, 9)).toBe(2);
  });
});
