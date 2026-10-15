import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Alert } from "@/components/alert";
import { PageHero } from "@/components/page-hero";
import { RasaCheckForm } from "@/components/rasa/check-form";
import { rasaEnabled } from "@/lib/rasa/service";

export const metadata: Metadata = {
  title: "Cek laporan Ruang Rasa",
  robots: { index: false, follow: false },
};

export default async function CekRuangRasaPage() {
  await connection();
  return (
    <div>
      <PageHero eyebrow="Ruang Rasa" title="Cek laporan" description="Masukkan kode laporan dan PIN yang kamu dapat saat melapor untuk melihat balasan." />
      <div className="mx-auto max-w-xl px-4 py-12">
        {rasaEnabled() ? (
          <section className="card"><RasaCheckForm /></section>
        ) : (
          <Alert tone="info">Ruang Rasa sedang disiapkan. Silakan coba lagi nanti.</Alert>
        )}
        <p className="mt-6 text-sm text-slate-600">
          Lupa kode atau PIN? Demi keamananmu, keduanya tidak dapat dipulihkan. Kamu boleh <Link href="/ruang-rasa" className="font-semibold text-teal-700 underline">membuat laporan baru</Link> atau
          menemui Guru BK langsung.
        </p>
      </div>
    </div>
  );
}
