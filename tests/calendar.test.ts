import { describe, expect, it } from "vitest";
import { buildMonthGrid, formatEventDate, monthRange, parseMonth, shiftMonth, todayInZone } from "@/lib/content/calendar";

describe("kalender", () => {
  it("grid Oktober 2026 dimulai Senin dan memuat seluruh tanggal", () => {
    const grid = buildMonthGrid(2026, 10, []);
    // 1 Oktober 2026 jatuh pada hari Kamis -> 3 sel bulan sebelumnya.
    expect(grid[0][3]).toMatchObject({ date: "2026-10-01", inMonth: true, day: 1 });
    expect(grid[0][0]).toMatchObject({ date: "2026-09-28", inMonth: false });
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });

  it("kegiatan beberapa hari muncul di setiap harinya", () => {
    const grid = buildMonthGrid(2026, 12, [{ id: "a", starts_on: "2026-11-30", ends_on: "2026-12-02" }]);
    const days = grid.flat().filter((c) => c.events.length).map((c) => c.date);
    expect(days).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  it("navigasi bulan melewati pergantian tahun", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("parameter bulan divalidasi", () => {
    const fb = { year: 2026, month: 10 };
    expect(parseMonth("2026-02", fb)).toEqual({ year: 2026, month: 2 });
    expect(parseMonth("2026-13", fb)).toEqual(fb);
    expect(parseMonth("abc", fb)).toEqual(fb);
    expect(parseMonth(undefined, fb)).toEqual(fb);
  });

  it("rentang bulan memperhitungkan tahun kabisat", () => {
    expect(monthRange(2028, 2)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthRange(2026, 2).end).toBe("2026-02-28");
  });

  it("tanggal hari ini menurut WITA", () => {
    expect(todayInZone("Asia/Makassar", new Date("2026-10-14T17:00:00Z"))).toBe("2026-10-15");
  });

  it("format tanggal kegiatan", () => {
    expect(formatEventDate({ starts_on: "2026-12-01", ends_on: "2026-12-01", start_time: "07:30:00", end_time: "10:00:00" }))
      .toBe("1 Desember 2026 · 07:30–10:00 WITA");
    expect(formatEventDate({ starts_on: "2026-12-01", ends_on: "2026-12-07", start_time: null, end_time: null }))
      .toBe("1 Desember 2026 – 7 Desember 2026");
  });
});
