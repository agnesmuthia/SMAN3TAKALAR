export type AchievementLevel = "sekolah" | "kecamatan" | "kabupaten" | "provinsi" | "nasional" | "internasional";

export const ACHIEVEMENT_LEVELS: AchievementLevel[] = ["internasional", "nasional", "provinsi", "kabupaten", "kecamatan", "sekolah"];

export const ACHIEVEMENT_LEVEL_LABEL: Record<AchievementLevel, string> = {
  sekolah: "Tingkat Sekolah",
  kecamatan: "Tingkat Kecamatan",
  kabupaten: "Tingkat Kabupaten/Kota",
  provinsi: "Tingkat Provinsi",
  nasional: "Tingkat Nasional",
  internasional: "Tingkat Internasional",
};
