import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION, siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

// CATATAN: teks ini adalah draf awal. Sekolah wajib meninjau dan
// menyesuaikannya dengan kebijakan sekolah dan UU No. 27 Tahun 2022 tentang
// Pelindungan Data Pribadi sebelum website dipublikasikan.
export default function KebijakanPrivasiPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
      <h1 className="text-3xl font-bold text-brand-900">Kebijakan Privasi</h1>
      <p className="mt-2 text-sm text-slate-500">Versi {PRIVACY_POLICY_VERSION}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Akun warga sekolah</h2>
        <p>
          Guru dan siswa dapat masuk menggunakan email dan kata sandi atau akun Google. Dari Google, kami hanya
          menerima informasi identitas dasar (alamat email dan pengenal akun) untuk keperluan autentikasi.
        </p>
        <p>
          Masuk dengan Google <strong>tidak</strong> otomatis memberikan peran guru atau siswa. Setiap akun baru
          wajib melengkapi profil dan diverifikasi oleh admin sekolah. NIP/NIS hanya dipakai untuk pencocokan
          dengan data sekolah, hanya dapat dilihat oleh pemilik akun dan admin berwenang, dan tidak dikirim ke Google.
        </p>
        <p>Website ini tidak memakai layanan analitik pihak ketiga.</p>
      </section>

      <section id="langganan" className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Langganan berita melalui email</h2>
        <p>
          Jika Anda berlangganan, kami menyimpan alamat email, status langganan, waktu pendaftaran dan konfirmasi,
          sumber formulir, serta bukti persetujuan (versi kebijakan ini). Data tersebut hanya digunakan untuk
          mengirim berita dan informasi sekolah yang bersifat publik.
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Langganan baru aktif setelah Anda mengeklik tautan konfirmasi di email (double opt-in).</li>
          <li>Langganan tidak memerlukan akun website dan terpisah dari akun guru/siswa. Masuk dengan Google bukan persetujuan menerima buletin.</li>
          <li>Setiap email berisi tautan berhenti berlangganan yang dapat dipakai tanpa masuk akun.</li>
          <li>Alamat email Anda tidak pernah ditampilkan kepada pelanggan lain; setiap email dikirim terpisah.</li>
          <li>Email dikirim melalui penyedia layanan email yang ditunjuk sekolah sebagai pemroses data.</li>
          <li>Pendaftaran yang tidak dikonfirmasi dihapus setelah 30 hari. Anda dapat meminta penghapusan data kepada sekolah.</li>
          <li>Setelah berhenti berlangganan atau dihapus, kami menyimpan sidik (hash) alamat email agar Anda tidak menerima buletin lagi secara tidak sengaja.</li>
        </ul>
        <p>
          Pelajar di bawah 18 tahun sebaiknya berlangganan dengan sepengetahuan dan persetujuan orang tua/wali.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Kontak</h2>
        <p>Pertanyaan tentang data pribadi dapat disampaikan kepada pengelola website {siteConfig.name}.</p>
      </section>
    </div>
  );
}
