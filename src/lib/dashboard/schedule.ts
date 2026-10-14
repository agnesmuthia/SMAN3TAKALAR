// Logika murni jadwal pelajaran (zona waktu sekolah: Asia/Makassar, WITA).

export const DAY_LABEL: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

export type ScheduleEntry = {
  id: string;
  class_name: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS" dari Postgres
  end_time: string;
  subject: string;
  room: string | null;
  teacher_id: string | null;
};

export function formatTime(value: string): string {
  return value.slice(0, 5);
}

// 1 = Senin ... 6 = Sabtu, 7 = Minggu (tidak ada jadwal).
export function dayOfWeekIn(timeZone: string, date: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name);
  return index + 1;
}

export function entriesForDay<T extends Pick<ScheduleEntry, "day_of_week" | "start_time">>(entries: T[], day: number): T[] {
  return entries.filter((e) => e.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function groupByDay<T extends Pick<ScheduleEntry, "day_of_week" | "start_time">>(entries: T[]): { day: number; entries: T[] }[] {
  return [1, 2, 3, 4, 5, 6]
    .map((day) => ({ day, entries: entriesForDay(entries, day) }))
    .filter((g) => g.entries.length > 0);
}

export function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
