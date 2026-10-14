// Logika murni impor jadwal pelajaran dari CSV/XLSX: membaca sel, memetakan
// kolom, memvalidasi setiap baris, dan mendeteksi duplikat/bentrok. Tidak
// menyentuh database; hasilnya ditampilkan sebagai pratinjau sebelum impor.

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type Cell = string | number | boolean | Date | null | undefined;

export type ColumnKey = "kelas" | "hari" | "mulai" | "selesai" | "mapel" | "guru" | "ruang";

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  kelas: ["kelas", "class", "rombel", "rombongan belajar"],
  hari: ["hari", "day"],
  mulai: ["jam mulai", "mulai", "jam_mulai", "start", "waktu mulai"],
  selesai: ["jam selesai", "selesai", "jam_selesai", "end", "waktu selesai"],
  mapel: ["mata pelajaran", "mapel", "pelajaran", "subject", "mata_pelajaran"],
  guru: ["guru", "nama guru", "guru pengampu", "pengajar", "teacher", "nama_guru"],
  ruang: ["ruang", "ruangan", "kelas ruang", "room"],
};
const REQUIRED: ColumnKey[] = ["kelas", "hari", "mulai", "selesai", "mapel"];

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  kelas: "kelas",
  hari: "hari",
  mulai: "jam mulai",
  selesai: "jam selesai",
  mapel: "mata pelajaran",
  guru: "guru",
  ruang: "ruang",
};

// ---------------------------------------------------------------------------
// CSV (RFC 4180, pemisah koma atau titik koma seperti Excel berbahasa Indonesia)
// ---------------------------------------------------------------------------
export function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Nilai sel
// ---------------------------------------------------------------------------
export function cellText(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[_\s]+/g, " ").replace(/[^a-z ]/g, "").trim();
}

export function mapColumns(header: Cell[]): { ok: true; columns: Partial<Record<ColumnKey, number>> } | { ok: false; error: string } {
  const columns: Partial<Record<ColumnKey, number>> = {};
  header.forEach((raw, index) => {
    const key = normalizeKey(cellText(raw));
    if (!key) return;
    for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, string[]][]) {
      if (columns[column] === undefined && aliases.some((a) => normalizeKey(a) === key)) {
        columns[column] = index;
        return;
      }
    }
  });
  const missing = REQUIRED.filter((c) => columns[c] === undefined);
  if (missing.length > 0) {
    return { ok: false, error: `Kolom wajib tidak ditemukan di baris judul: ${missing.map((c) => COLUMN_LABEL[c]).join(", ")}.` };
  }
  return { ok: true, columns };
}

const DAYS: Record<string, number> = {
  senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export function parseDay(value: Cell): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 6 ? value : null;
  const text = cellText(value).toLowerCase();
  if (/^[1-6]$/.test(text)) return Number(text);
  return DAYS[text] ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Menerima "07:30", "7.30", "07.30.00", nilai waktu Excel (pecahan hari) atau Date.
export function parseTime(value: Cell): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }
  if (typeof value === "number") {
    if (!(value >= 0 && value < 1)) return null;
    const minutes = Math.round(value * 24 * 60);
    return minutes >= 24 * 60 ? null : `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }
  const match = cellText(value).match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------
export type Teacher = { id: string; name: string };
export type ExistingEntry = {
  class_name: string;
  day_of_week: number;
  start_time: string; // "HH:MM" atau "HH:MM:SS"
  end_time: string;
  subject: string;
  teacher_id: string | null;
};
export type ValidRow = {
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string | null;
  room: string | null;
};
export type RowStatus = "valid" | "sudah_ada" | "error";
export type RowReport = {
  row: number; // nomor baris di file (baris judul = 1)
  status: RowStatus;
  messages: string[];
  values: Record<ColumnKey, string>;
};
export type ImportResult = {
  report: RowReport[];
  valid: ValidRow[];
  counts: { total: number; valid: number; existing: number; error: number };
};

const DAY_NAME = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const hhmm = (t: string) => t.slice(0, 5);
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  hhmm(aStart) < hhmm(bEnd) && hhmm(bStart) < hhmm(aEnd);
const slotKey = (cls: string, day: number, start: string) => `${cls.toLowerCase()}|${day}|${hhmm(start)}`;

type Accepted = ValidRow & { row: number };

// Bentrok kelas/guru antara satu baris dan jadwal yang sudah ada atau baris lain.
export function findConflicts(
  candidate: ValidRow,
  existing: ExistingEntry[],
  accepted: Accepted[],
): string[] {
  const messages: string[] = [];
  const cls = candidate.class_name.toLowerCase();
  for (const e of existing) {
    if (e.day_of_week !== candidate.day_of_week || !overlaps(candidate.start_time, candidate.end_time, e.start_time, e.end_time)) continue;
    const time = `${hhmm(e.start_time)}–${hhmm(e.end_time)}`;
    if (e.class_name.toLowerCase() === cls && hhmm(e.start_time) !== candidate.start_time) {
      messages.push(`Bentrok dengan jadwal kelas yang sudah ada (${time} ${e.subject}).`);
    } else if (candidate.teacher_id && e.teacher_id === candidate.teacher_id && e.class_name.toLowerCase() !== cls) {
      messages.push(`Guru sudah mengajar ${e.class_name} pada ${DAY_NAME[e.day_of_week]} ${time}.`);
    }
  }
  for (const a of accepted) {
    if (a.day_of_week !== candidate.day_of_week || !overlaps(candidate.start_time, candidate.end_time, a.start_time, a.end_time)) continue;
    if (a.class_name.toLowerCase() === cls) {
      messages.push(`Bentrok dengan baris ${a.row} (kelas yang sama, ${a.start_time}–${a.end_time}).`);
    } else if (candidate.teacher_id && a.teacher_id === candidate.teacher_id) {
      messages.push(`Guru bentrok dengan baris ${a.row} (${a.class_name}, ${a.start_time}–${a.end_time}).`);
    }
  }
  return messages;
}

export function validateScheduleRows(
  rows: Cell[][],
  context: { teachers: Teacher[]; existing: ExistingEntry[] },
): { ok: true; result: ImportResult } | { ok: false; error: string } {
  const [header, ...body] = rows;
  if (!header) return { ok: false, error: "File kosong." };
  const mapped = mapColumns(header);
  if (!mapped.ok) return mapped;
  const { columns } = mapped;

  const teachersByName = new Map<string, Teacher[]>();
  for (const t of context.teachers) {
    const key = normalizeName(t.name);
    teachersByName.set(key, [...(teachersByName.get(key) ?? []), t]);
  }
  const existingSlots = new Map(context.existing.map((e) => [slotKey(e.class_name, e.day_of_week, e.start_time), e]));

  const report: RowReport[] = [];
  const valid: ValidRow[] = [];
  const accepted: Accepted[] = [];
  const seen = new Map<string, number>();
  let dataRows = 0;

  for (let i = 0; i < body.length; i++) {
    const cells = body[i];
    const get = (c: ColumnKey): Cell => (columns[c] === undefined ? null : cells[columns[c]!]);
    const values = Object.fromEntries(
      (Object.keys(COLUMN_ALIASES) as ColumnKey[]).map((c) => {
        const raw = get(c);
        return [c, c === "mulai" || c === "selesai" ? parseTime(raw) ?? cellText(raw) : cellText(raw)];
      }),
    ) as Record<ColumnKey, string>;
    if (Object.values(values).every((v) => v === "")) continue; // baris kosong
    dataRows++;
    if (dataRows > MAX_IMPORT_ROWS) {
      return { ok: false, error: `File berisi lebih dari ${MAX_IMPORT_ROWS} baris. Pecah menjadi beberapa file.` };
    }

    const rowNumber = i + 2;
    const messages: string[] = [];
    const className = values.kelas;
    if (!className) messages.push("Kelas wajib diisi.");
    else if (className.length > 40) messages.push("Kelas maksimal 40 karakter.");
    const day = parseDay(get("hari"));
    if (day === null) messages.push("Hari harus Senin–Sabtu (atau angka 1–6).");
    const start = parseTime(get("mulai"));
    const end = parseTime(get("selesai"));
    if (!start) messages.push("Jam mulai tidak valid (contoh: 07:30).");
    if (!end) messages.push("Jam selesai tidak valid (contoh: 09:00).");
    if (start && end && end <= start) messages.push("Jam selesai harus setelah jam mulai.");
    const subject = values.mapel;
    if (!subject) messages.push("Mata pelajaran wajib diisi.");
    else if (subject.length > 100) messages.push("Mata pelajaran maksimal 100 karakter.");
    const room = values.ruang;
    if (room.length > 40) messages.push("Ruang maksimal 40 karakter.");

    let teacherId: string | null = null;
    if (values.guru) {
      const matches = teachersByName.get(normalizeName(values.guru)) ?? [];
      if (matches.length === 0) messages.push(`Guru "${values.guru}" tidak ditemukan di daftar guru aktif.`);
      else if (matches.length > 1) messages.push(`Ada ${matches.length} guru bernama "${values.guru}"; tetapkan gurunya secara manual setelah impor.`);
      else teacherId = matches[0].id;
    }

    if (messages.length > 0 || day === null || !start || !end) {
      report.push({ row: rowNumber, status: "error", messages, values });
      continue;
    }

    const candidate: ValidRow = { class_name: className, day_of_week: day, start_time: start, end_time: end, subject, teacher_id: teacherId, room: room || null };
    const key = slotKey(className, day, start);
    const duplicateOf = seen.get(key);
    if (duplicateOf !== undefined) {
      report.push({ row: rowNumber, status: "error", messages: [`Duplikat dengan baris ${duplicateOf} (kelas, hari, dan jam mulai sama).`], values });
      continue;
    }
    seen.set(key, rowNumber);

    const already = existingSlots.get(key);
    if (already) {
      report.push({
        row: rowNumber,
        status: "sudah_ada",
        messages: [`Sudah ada di jadwal semester ini (${already.subject}); dilewati, tidak ditimpa.`],
        values,
      });
      continue;
    }

    const conflicts = findConflicts(candidate, context.existing, accepted);
    if (conflicts.length > 0) {
      report.push({ row: rowNumber, status: "error", messages: conflicts, values });
      continue;
    }

    accepted.push({ ...candidate, row: rowNumber });
    valid.push(candidate);
    report.push({ row: rowNumber, status: "valid", messages: [], values });
  }

  if (dataRows === 0) return { ok: false, error: "Tidak ada baris data di bawah baris judul." };
  const count = (s: RowStatus) => report.filter((r) => r.status === s).length;
  return {
    ok: true,
    result: { report, valid, counts: { total: dataRows, valid: count("valid"), existing: count("sudah_ada"), error: count("error") } },
  };
}

// Pemeriksaan ulang tepat sebelum impor: apakah baris valid kini bentrok dengan
// jadwal yang ditambahkan setelah pratinjau dibuat?
export function recheckBeforeCommit(valid: ValidRow[], existing: ExistingEntry[]): string[] {
  const existingSlots = new Set(existing.map((e) => slotKey(e.class_name, e.day_of_week, e.start_time)));
  const problems: string[] = [];
  for (const row of valid) {
    if (existingSlots.has(slotKey(row.class_name, row.day_of_week, row.start_time))) continue; // akan dilewati
    const conflicts = findConflicts(row, existing, []);
    if (conflicts.length > 0) problems.push(`${row.class_name} ${DAY_NAME[row.day_of_week]} ${row.start_time}: ${conflicts[0]}`);
  }
  return problems;
}

// Pengenal jenis file dari isi (bukan hanya ekstensi).
export function detectSpreadsheetType(bytes: Uint8Array, fileName: string): "xlsx" | "csv" | null {
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return isZip ? "xlsx" : null;
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return isZip ? null : "csv";
  return null;
}
