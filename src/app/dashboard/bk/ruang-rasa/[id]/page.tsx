import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { CATEGORY_LABEL, STAFF_STATUS_LABEL } from "@/lib/rasa/labels";
import { decryptStaffReport, rasaKey } from "@/lib/rasa/service";
import { rasaSetStatusAction, rasaStaffReplyAction } from "../actions";

export const metadata: Metadata = { title: "Laporan Ruang Rasa", robots: { index: false, follow: false } };

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function LaporanRuangRasaPage({ params }: PageProps<"/dashboard/bk/ruang-rasa/[id]">) {
  const { id } = await params;
  const ctx = await requireRole(["guru_bk"], `/dashboard/bk/ruang-rasa/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  if (!rasaKey()) {
    return (
      <DashboardShell title="Laporan Ruang Rasa" role="guru_bk">
        <Alert tone="error">Kunci enkripsi Ruang Rasa belum diatur di server, sehingga laporan tidak dapat dibaca. Hubungi petugas teknis.</Alert>
      </DashboardShell>
    );
  }
  // Fungsi database memeriksa petugas ditugaskan dan MENCATAT pembukaan ini.
  const { data, error } = await ctx.supabase.rpc("rasa_get_report", { p_id: id });
  if (error?.code === "P0002") notFound();
  if (error?.code === "42501") {
    return (
      <DashboardShell title="Laporan Ruang Rasa" role="guru_bk">
        <Alert tone="warning">Akun Anda belum ditugaskan sebagai petugas Ruang Rasa.</Alert>
      </DashboardShell>
    );
  }
  if (error || !data) {
    return (
      <DashboardShell title="Laporan Ruang Rasa" role="guru_bk">
        <Alert tone="error">Laporan tidak dapat dimuat saat ini.</Alert>
      </DashboardShell>
    );
  }
  const report = decryptStaffReport(data as Parameters<typeof decryptStaffReport>[0]);

  return (
    <DashboardShell title={`Laporan ${report.referenceCode}`} role="guru_bk">
      <Link href="/dashboard/bk/ruang-rasa" prefetch={false} className="text-sm text-teal-700 hover:underline">← Semua laporan</Link>

      <section className={`card border-l-4 ${report.urgent && report.status !== "selesai" ? "!border-l-red-600" : "!border-l-teal-600"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">{CATEGORY_LABEL[report.category]}</span>
          <span className="rounded-full bg-navy-900 px-2 py-0.5 text-white">{STAFF_STATUS_LABEL[report.status]}</span>
          {report.urgent && <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">Ditandai mendesak oleh pelapor</span>}
          <span className="text-slate-500">Diterima {fmt.format(new Date(report.createdAt))}</span>
        </div>
        {report.content ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="whitespace-pre-line text-base leading-relaxed text-slate-900">{report.content.body}</p>
            <dl className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
              <div><dt className="text-xs text-slate-500">Kapan</dt><dd>{report.content.when || "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Di mana</dt><dd>{report.content.where || "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Cara menghubungi (dari pelapor)</dt><dd>{report.content.contact || "Anonim"}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="mt-4"><Alert tone="error">Isi laporan tidak dapat didekripsi (kunci enkripsi berubah atau data rusak). Hubungi petugas teknis; jangan menghapus apa pun.</Alert></div>
        )}
      </section>

      <section aria-labelledby="percakapan">
        <h2 id="percakapan" className="mb-2 text-lg font-semibold">Percakapan dengan pelapor</h2>
        {report.messages.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada pesan.</p>
        ) : (
          <ul className="space-y-3">
            {report.messages.map((m) => (
              <li key={m.id} className={`max-w-[85%] rounded-2xl p-4 text-sm ${m.sender === "bk" ? "ml-auto bg-navy-900 text-white" : "bg-teal-50 text-slate-800"}`}>
                <p className="text-xs font-semibold opacity-80">{m.sender === "bk" ? "Guru BK" : "Pelapor"} · {fmt.format(new Date(m.createdAt))}</p>
                <p className="mt-1 whitespace-pre-line">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.status !== "selesai" && (
        <section className="card">
          <h2 className="font-semibold">Balas pelapor</h2>
          <p className="mb-3 text-xs text-slate-600">Pelapor melihat balasan ini lewat kode dan PIN-nya. Hindari menuliskan data yang dapat membuka identitas pihak lain.</p>
          <ActionForm action={rasaStaffReplyAction} submitLabel="Kirim balasan" submitClassName="btn-primary">
            <input type="hidden" name="id" value={report.id} />
            <label htmlFor="text" className="sr-only">Balasan</label>
            <textarea id="text" name="text" required maxLength={3000} rows={4} className="input" />
          </ActionForm>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold">Status penanganan</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {report.status !== "diproses" && report.status !== "selesai" && (
            <ActionForm action={rasaSetStatusAction} submitLabel="Mulai tangani" className="" submitClassName="btn-secondary">
              <input type="hidden" name="id" value={report.id} /><input type="hidden" name="status" value="diproses" />
            </ActionForm>
          )}
          {report.status !== "selesai" ? (
            <ActionForm action={rasaSetStatusAction} submitLabel="Tandai selesai" className="" submitClassName="btn-primary">
              <input type="hidden" name="id" value={report.id} /><input type="hidden" name="status" value="selesai" />
            </ActionForm>
          ) : (
            <ActionForm action={rasaSetStatusAction} submitLabel="Buka kembali" className="" submitClassName="btn-secondary">
              <input type="hidden" name="id" value={report.id} /><input type="hidden" name="status" value="diproses" />
            </ActionForm>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">Laporan selesai dihapus otomatis sesuai masa simpan yang ditetapkan sekolah.</p>
      </section>
    </DashboardShell>
  );
}
