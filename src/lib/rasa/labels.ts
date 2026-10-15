export type RasaCategory = "perundungan" | "kekerasan_fisik" | "kekerasan_verbal" | "pelecehan" | "siber" | "lainnya";
export type RasaStatus = "baru" | "diproses" | "selesai";
export type RasaSender = "pelapor" | "bk";

export const RASA_CATEGORIES: RasaCategory[] = ["perundungan", "kekerasan_fisik", "kekerasan_verbal", "pelecehan", "siber", "lainnya"];

export const CATEGORY_LABEL: Record<RasaCategory, string> = {
  perundungan: "Perundungan (bullying)",
  kekerasan_fisik: "Kekerasan fisik",
  kekerasan_verbal: "Kekerasan verbal atau ancaman",
  pelecehan: "Pelecehan",
  siber: "Perundungan di internet / media sosial",
  lainnya: "Lainnya / belum yakin",
};

// Bahasa untuk pelapor (siswa).
export const REPORTER_STATUS_LABEL: Record<RasaStatus, string> = {
  baru: "Laporanmu sudah diterima dan menunggu dibaca Guru BK.",
  diproses: "Laporanmu sedang ditangani Guru BK.",
  selesai: "Penanganan laporan ini sudah selesai.",
};

export const STAFF_STATUS_LABEL: Record<RasaStatus, string> = { baru: "Baru", diproses: "Diproses", selesai: "Selesai" };

// Isi terenkripsi sebuah laporan.
export type RasaContent = { v: 1; body: string; when: string; where: string; contact: string };
