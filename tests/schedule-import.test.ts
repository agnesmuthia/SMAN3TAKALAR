import { describe, expect, it } from "vitest";
import {
  detectSpreadsheetType,
  mapColumns,
  parseCsv,
  parseDay,
  parseTime,
  recheckBeforeCommit,
  validateScheduleRows,
  type ExistingEntry,
} from "@/lib/school/schedule-import";

const teachers = [
  { id: "t-ani", name: "Ani Contoh, S.Pd." },
  { id: "t-budi", name: "Budi Contoh" },
  { id: "t-c1", name: "Citra Ganda" },
  { id: "t-c2", name: "Citra Ganda" },
];
const header = ["Kelas", "Hari", "Jam Mulai", "Jam Selesai", "Mata Pelajaran", "Guru", "Ruang"];

describe("parseCsv", () => {
  it("membaca koma, tanda kutip, dan BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("mendeteksi pemisah titik koma (Excel Indonesia)", () => {
    expect(parseCsv("kelas;hari\nX-1;Senin")).toEqual([["kelas", "hari"], ["X-1", "Senin"]]);
  });
  it("baris baru di dalam kutipan tetap satu sel", () => {
    expect(parseCsv('a,b\n"baris\nkedua",c')).toEqual([["a", "b"], ["baris\nkedua", "c"]]);
  });
});

describe("parser sel", () => {
  it("hari dalam bahasa Indonesia atau angka", () => {
    expect(parseDay("Senin")).toBe(1);
    expect(parseDay("JUMAT")).toBe(5);
    expect(parseDay("Jum'at")).toBe(5);
    expect(parseDay(6)).toBe(6);
    expect(parseDay("Minggu")).toBeNull();
    expect(parseDay(7)).toBeNull();
  });
  it("jam dari teks, pecahan Excel, dan Date", () => {
    expect(parseTime("7.30")).toBe("07:30");
    expect(parseTime("07:30:00")).toBe("07:30");
    expect(parseTime(0.3125)).toBe("07:30");
    expect(parseTime(new Date(Date.UTC(1899, 11, 30, 9, 15)))).toBe("09:15");
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("pagi")).toBeNull();
  });
  it("kolom wajib dan alias judul", () => {
    expect(mapColumns(["KELAS", "hari", "mulai", "selesai", "mapel"]).ok).toBe(true);
    const missing = mapColumns(["kelas", "hari"]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("jam mulai");
  });
  it("jenis file dari isi, bukan hanya ekstensi", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]);
    expect(detectSpreadsheetType(zip, "jadwal.xlsx")).toBe("xlsx");
    expect(detectSpreadsheetType(new TextEncoder().encode("kelas,hari"), "jadwal.xlsx")).toBeNull();
    expect(detectSpreadsheetType(new TextEncoder().encode("kelas,hari"), "jadwal.csv")).toBe("csv");
    expect(detectSpreadsheetType(zip, "jadwal.csv")).toBeNull();
    expect(detectSpreadsheetType(zip, "jadwal.xls")).toBeNull();
  });
});

describe("validateScheduleRows", () => {
  const existing: ExistingEntry[] = [
    { class_name: "X-1", day_of_week: 1, start_time: "07:30:00", end_time: "09:00:00", subject: "Matematika", teacher_id: "t-budi" },
  ];

  it("membuat laporan per baris: valid, sudah ada, dan berbagai kesalahan", () => {
    const res = validateScheduleRows(
      [
        header,
        ["X-1", "Senin", "07:30", "09:00", "Fisika", "", ""], // 2: sudah ada
        ["X-1", "Senin", "09:15", "10:45", "Biologi", "ani contoh s.pd", "Lab"], // 3: valid (nama fleksibel)
        ["X-1", "Senin", "09:15", "10:00", "Kimia", "", ""], // 4: duplikat baris 3
        ["X-2", "Senin", "08:00", "09:30", "Sejarah", "Budi Contoh", ""], // 5: guru bentrok dg data lama
        ["X-3", "Minggu", "07:30", "09:00", "Seni", "", ""], // 6: hari salah
        ["X-3", "Selasa", "10:00", "09:00", "Seni", "", ""], // 7: jam terbalik
        ["X-3", "Selasa", "07:30", "09:00", "Seni", "Tidak Ada", ""], // 8: guru tak dikenal
        ["X-3", "Selasa", "07:30", "09:00", "Seni", "Citra Ganda", ""], // 9: nama ganda
        ["", "", "", "", "", "", ""], // kosong: diabaikan
        ["X-2", "Senin", "09:15", "10:45", "PJOK", "Ani Contoh, S.Pd.", ""], // 11: guru bentrok dg baris 3
        ["X-1", "Senin", "08:30", "09:30", "Ekonomi", "", ""], // 12: bentrok kelas dg data lama
      ],
      { teachers, existing },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byRow = new Map(res.result.report.map((r) => [r.row, r]));
    expect(byRow.get(2)?.status).toBe("sudah_ada");
    expect(byRow.get(3)?.status).toBe("valid");
    expect(byRow.get(4)?.messages[0]).toContain("Duplikat dengan baris 3");
    expect(byRow.get(5)?.messages[0]).toContain("Guru sudah mengajar X-1");
    expect(byRow.get(6)?.messages[0]).toContain("Hari");
    expect(byRow.get(7)?.messages[0]).toContain("setelah jam mulai");
    expect(byRow.get(8)?.messages[0]).toContain("tidak ditemukan");
    expect(byRow.get(9)?.messages[0]).toContain("2 guru");
    expect(byRow.has(10)).toBe(false);
    expect(byRow.get(11)?.messages[0]).toContain("Guru bentrok dengan baris 3");
    expect(byRow.get(12)?.messages[0]).toContain("Bentrok dengan jadwal kelas");
    expect(res.result.counts).toEqual({ total: 10, valid: 1, existing: 1, error: 8 });
    expect(res.result.valid).toEqual([
      { class_name: "X-1", day_of_week: 1, start_time: "09:15", end_time: "10:45", subject: "Biologi", teacher_id: "t-ani", room: "Lab" },
    ]);
  });

  it("menolak file tanpa kolom wajib atau tanpa data", () => {
    expect(validateScheduleRows([["nama", "alamat"], ["a", "b"]], { teachers, existing }).ok).toBe(false);
    expect(validateScheduleRows([header], { teachers, existing }).ok).toBe(false);
    expect(validateScheduleRows([], { teachers, existing }).ok).toBe(false);
  });

  it("membatasi jumlah baris", () => {
    const rows = [header, ...Array.from({ length: 2001 }, (_, i) => [`K-${i}`, "Senin", "07:00", "08:00", "Mapel", "", ""])];
    const res = validateScheduleRows(rows, { teachers, existing: [] });
    expect(res.ok).toBe(false);
  });

  it("pemeriksaan ulang menemukan bentrok baru sebelum impor", () => {
    const valid = [{ class_name: "X-1", day_of_week: 2, start_time: "07:30", end_time: "09:00", subject: "A", teacher_id: null, room: null }];
    expect(recheckBeforeCommit(valid, [])).toEqual([]);
    const later: ExistingEntry[] = [{ class_name: "X-1", day_of_week: 2, start_time: "08:00", end_time: "09:30", subject: "B", teacher_id: null }];
    expect(recheckBeforeCommit(valid, later)).toHaveLength(1);
    const sameSlot: ExistingEntry[] = [{ class_name: "X-1", day_of_week: 2, start_time: "07:30", end_time: "09:00", subject: "B", teacher_id: null }];
    expect(recheckBeforeCommit(valid, sameSlot)).toEqual([]);
  });
});

describe("file XLSX nyata", () => {
  it("membaca sel waktu Excel dan teks lewat read-excel-file", async () => {
    const { readFile } = await import("node:fs/promises");
    const { readSheet } = await import("read-excel-file/node");
    const buffer = await readFile(new URL("./fixtures/jadwal-contoh.xlsx", import.meta.url));
    expect(detectSpreadsheetType(new Uint8Array(buffer), "jadwal-contoh.xlsx")).toBe("xlsx");
    const rows = (await readSheet(buffer)) as unknown as (string | number | Date | null)[][];
    const res = validateScheduleRows(rows, { teachers, existing: [] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.valid.map((v) => [v.day_of_week, v.start_time, v.end_time, v.teacher_id])).toEqual([
      [1, "07:30", "09:00", "t-ani"],
      [2, "09:15", "10:45", null],
    ]);
  });
});
