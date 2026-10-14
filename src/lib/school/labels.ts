export const TERM_LABEL: Record<number, string> = { 1: "Ganjil", 2: "Genap" };

export type SemesterOption = { id: string; term: number; is_active: boolean; year: { name: string } | null };

export function semesterLabel(s: Pick<SemesterOption, "term" | "year">): string {
  return `${s.year?.name ?? "?"} · Semester ${TERM_LABEL[s.term] ?? s.term}`;
}

export const DECREE_STATUS_LABEL: Record<"berlaku" | "arsip", string> = { berlaku: "Masih berlaku", arsip: "Arsip (tidak berlaku)" };
export const VISIBILITY_LABEL: Record<"public" | "internal", string> = { public: "Publik", internal: "Internal warga sekolah" };
