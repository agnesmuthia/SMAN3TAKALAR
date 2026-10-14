import { describe, expect, it } from "vitest";
import { dayOfWeekIn, entriesForDay, formatTime, groupByDay, isHttpsUrl, isValidTimeInput } from "@/lib/dashboard/schedule";

const e = (day: number, start: string) => ({ id: `${day}-${start}`, day_of_week: day, start_time: start });

describe("jadwal", () => {
  it("mengurutkan per jam dan mengelompokkan per hari", () => {
    const entries = [e(2, "10:00:00"), e(1, "09:15:00"), e(1, "07:30:00"), e(4, "08:00:00")];
    expect(entriesForDay(entries, 1).map((x) => x.start_time)).toEqual(["07:30:00", "09:15:00"]);
    expect(groupByDay(entries).map((g) => g.day)).toEqual([1, 2, 4]);
    expect(groupByDay([])).toEqual([]);
  });

  it("memformat jam", () => {
    expect(formatTime("07:30:00")).toBe("07:30");
  });

  it("menghitung hari menurut WITA, bukan UTC", () => {
    // Senin 2026-10-12 18:00 UTC = Selasa 02:00 WITA.
    expect(dayOfWeekIn("Asia/Makassar", new Date("2026-10-12T18:00:00Z"))).toBe(2);
    expect(dayOfWeekIn("Asia/Makassar", new Date("2026-10-12T10:00:00Z"))).toBe(1);
    // Minggu = 7 (tidak ada jadwal).
    expect(dayOfWeekIn("Asia/Makassar", new Date("2026-10-18T04:00:00Z"))).toBe(7);
  });

  it("memvalidasi input jam", () => {
    expect(isValidTimeInput("07:30")).toBe(true);
    expect(isValidTimeInput("24:00")).toBe(false);
    expect(isValidTimeInput("7:30")).toBe(false);
  });
});

describe("tautan tugas", () => {
  it("hanya menerima https", () => {
    expect(isHttpsUrl("https://contoh.test/a")).toBe(true);
    expect(isHttpsUrl("http://contoh.test")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("bukan url")).toBe(false);
  });
});
