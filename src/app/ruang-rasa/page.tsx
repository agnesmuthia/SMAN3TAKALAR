import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Alert } from "@/components/alert";
import { PageHero } from "@/components/page-hero";
import { RasaReportForm } from "@/components/rasa/report-form";
import { getRasaNotice, rasaEnabled } from "@/lib/rasa/service";

export const metadata: Metadata = {
  title: "Ruang Rasa",
  description: "Ruang aman untuk melaporkan perundungan dan kekerasan di sekolah, boleh tanpa nama.",
};

export default async function RuangRasaPage() {
  await connection();
  const enabled = rasaEnabled();
  const notice = await getRasaNotice();
  return (
    <div>
      <PageHero eyebrow="Ruang aman" title="Ruang Rasa" description="Tempat untuk bercerita dengan aman jika kamu mengalami atau melihat perundungan atau kekerasan di sekolah. Kamu boleh melapor tanpa menyebut namamu." />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-5">
        <aside className="space-y-4 lg:col-span-2">
          <section className="card">
            <h2 className="font-semibold text-navy-900">Yang perlu kamu tahu</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✔ <strong>Boleh anonim.</strong> Tidak ada akun atau nama yang diminta. Alamat internet (IP) tidak disimpan.</li>
              <li>✔ <strong>Hanya Guru BK yang ditugaskan</strong> yang bisa membaca. Admin website dan guru lain tidak bisa membukanya.</li>
              <li>✔ <strong>Ceritamu disandikan</strong> sebelum disimpan, dan setiap pembukaan laporan dicatat.</li>
              <li>✔ Kamu mendapat <strong>kode dan PIN</strong> untuk melihat balasan di <Link href="/ruang-rasa/cek" className="font-semibold text-teal-700 underline">Cek laporan</Link>.</li>
              <li>✔ Laporan yang sudah selesai dihapus otomatis setelah beberapa bulan.</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-gold-500/50 bg-gold-500/10 p-5 text-sm text-slate-800">
            <h2 className="font-semibold text-navy-900">Kalau bahaya terjadi sekarang</h2>
            <p className="mt-2">
              Ruang Rasa <strong>tidak dipantau setiap saat</strong>. Jika kamu atau temanmu sedang dalam bahaya, segera cari guru atau orang dewasa terdekat, atau hubungi
              layanan darurat <strong>112</strong>.
            </p>
            {notice && <p className="mt-3 whitespace-pre-line border-t border-gold-500/40 pt-3"><strong>Dari sekolah:</strong> {notice}</p>}
          </section>
          <p className="text-sm text-slate-600">
            Sudah punya kode dan PIN? <Link href="/ruang-rasa/cek" className="font-semibold text-teal-700 underline">Cek laporanmu</Link>.
          </p>
        </aside>
        <div className="lg:col-span-3">
          {enabled ? (
            <section className="card" aria-labelledby="judul-form">
              <h2 id="judul-form" className="text-lg font-bold text-navy-900">Tulis laporan</h2>
              <div className="mt-4"><RasaReportForm /></div>
            </section>
          ) : (
            <Alert tone="info">
              Ruang Rasa sedang disiapkan dan belum dapat menerima laporan. Sementara itu, silakan temui Guru BK atau guru yang kamu percayai secara langsung.
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
