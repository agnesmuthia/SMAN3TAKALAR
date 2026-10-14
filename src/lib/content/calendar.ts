// Logika murni kalender kegiatan (tanggal dalam format YYYY-MM-DD, zona WITA).

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  visibility: "public" | "internal";
};

export type EventCategory = "akademik" | "ujian" | "libur" | "kegiatan" | "rapat" | "lainnya";

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  akademik: "Akademik",
  ujian: "Ujian",
  libur: "Libur",
  kegiatan: "Kegiatan",
  rapat: "Rapat",
  lainnya: "Lainnya",
};

export const EVENT_CATEGORY_STYLE: Record<EventCategory, string> = {
  akademik: "bg-teal-50 text-teal-800 border-teal-200",
  ujian: "bg-amber-50 text-amber-900 border-amber-200",
  libur: "bg-rose-50 text-rose-800 border-rose-200",
  kegiatan: "bg-navy-50 text-navy-900 border-navy-100",
  rapat: "bg-slate-100 text-slate-700 border-slate-200",
  lainnya: "bg-white text-slate-700 border-slate-200",
};

export const MONTH_LABEL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const WEEKDAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// "2026-10" -> {year:2026, month:10}; nilai tidak valid -> bulan acuan.
export function parseMonth(raw: unknown, fallback: { year: number; month: number }): { year: number; month: number } {
  if (typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (y >= 2000 && y <= 2100) return { year: y, month: m };
  }
  return fallback;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: isoDate(year, month, 1), end: isoDate(year, month, last) };
}

export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type DayCell<T> = { date: string; day: number; inMonth: boolean; events: T[] };

// Grid bulan dimulai hari Senin; kegiatan beberapa hari muncul di setiap harinya.
export function buildMonthGrid<T extends Pick<CalendarEvent, "starts_on" | "ends_on">>(
  year: number,
  month: number,
  events: T[],
): DayCell<T>[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // 0 = Senin
  const start = new Date(first.getTime() - offset * 86400000);
  const lastDay = new Date(Date.UTC(year, month, 0));
  const totalDays = offset + lastDay.getUTCDate();
  const weeks = Math.ceil(totalDays / 7);

  const grid: DayCell<T>[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: DayCell<T>[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86400000);
      const iso = date.toISOString().slice(0, 10);
      row.push({
        date: iso,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month - 1,
        events: events.filter((e) => e.starts_on <= iso && e.ends_on >= iso),
      });
    }
    grid.push(row);
  }
  return grid;
}

export function formatEventDate(e: Pick<CalendarEvent, "starts_on" | "ends_on" | "start_time" | "end_time">): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const time = e.start_time ? ` · ${e.start_time.slice(0, 5)}${e.end_time ? `–${e.end_time.slice(0, 5)}` : ""} WITA` : "";
  return e.starts_on === e.ends_on ? `${fmt(e.starts_on)}${time}` : `${fmt(e.starts_on)} – ${fmt(e.ends_on)}${time}`;
}
