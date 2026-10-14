// Pesan error yang aman ditampilkan. Hanya kode yang terdaftar di sini yang
// diterjemahkan; teks dari parameter URL tidak pernah ditampilkan mentah.
const MESSAGES: Record<string, string> = {
  oauth_gagal: "Masuk dengan Google gagal. Silakan coba lagi atau gunakan metode lain.",
  oauth_dibatalkan: "Proses masuk dengan Google dibatalkan.",
  akun_nonaktif: "Akun Anda dinonaktifkan. Hubungi admin sekolah.",
  tautan_tidak_valid: "Tautan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.",
  akses_ditolak: "Anda tidak memiliki akses ke halaman tersebut.",
  tautan_gagal: "Akun Google gagal ditautkan. Akun Google tersebut mungkin sudah terhubung ke akun lain.",
  konfigurasi: "Layanan masuk belum dikonfigurasi.",
};

export function authErrorMessage(code: string | string[] | undefined): string | null {
  if (typeof code !== "string") return null;
  return MESSAGES[code] ?? null;
}
