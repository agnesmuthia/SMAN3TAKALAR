import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, validatePdf } from "@/lib/school/pdf";

const enc = (s: string) => new TextEncoder().encode(s);

describe("validatePdf", () => {
  it("menerima PDF biasa", () => {
    expect(validatePdf(enc("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF")).ok).toBe(true);
  });
  it("menolak file yang bukan PDF walau bernama .pdf", () => {
    expect(validatePdf(enc("<html><script>alert(1)</script>")).ok).toBe(false);
    expect(validatePdf(new Uint8Array([0x50, 0x4b, 0x03, 0x04])).ok).toBe(false);
  });
  it("menolak PDF dengan JavaScript atau aksi Launch", () => {
    expect(validatePdf(enc("%PDF-1.4\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>")).ok).toBe(false);
    expect(validatePdf(enc("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>")).ok).toBe(false);
  });
  it("menolak file kosong dan terlalu besar", () => {
    expect(validatePdf(new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(enc("%PDF-"));
    expect(validatePdf(big).ok).toBe(false);
  });
});
