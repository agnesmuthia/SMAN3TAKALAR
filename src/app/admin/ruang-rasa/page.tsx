import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireRole } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";
import { resolveEmailProvider } from "@/lib/newsletter/provider";
import { rasaEnabled } from "@/lib/rasa/service";
import { saveRasaSettingsAction, setRasaHandlerAction } from "./actions";

export const metadata: Metadata = { title: "Ruang Rasa" };

type Overview = {
  counts: { baru: number; diproses: number; selesai: number; mendesak_terbuka: number };
  handlers: { user_id: string; full_name: string | null; assigned_at: string; active: boolean }[];
  log: { id: number; created_at: string; action: string; reference_code: string | null; actor_name: string | null }[];
};

const ACTION_LABEL: Record<string, string> = {
  buka: "Membuka laporan", balas: "Membalas pelapor", hapus_otomatis: "Dihapus otomatis (masa simpan lewat)",
};
function describe(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  if (action.startsWith("status:")) return `Mengubah status ke "${action.slice(7)}"`;
  return action;
}

export default async function AdminRuangRasaPage() {
  const ctx = await requireRole(["admin"], "/admin/ruang-rasa");
  const { data: raw } = await ctx.supabase.rpc("admin_rasa_overview");
  const overview = raw as Overview | null;
  const [{ data: bk }, { data: settings }] = await Promise.all([
    ctx.supabase.from("profiles").select("id, full_name").eq("role", "guru_bk").eq("status", "active").order("full_name"),
    ctx.supabase.from("app_settings").select("rasa_retention_months, rasa_notice").maybeSingle<{ rasa_retention_months: number; rasa_notice: string | null }>(),
  ]);
  const accounts = (bk ?? []) as { id: string; full_name: string | null }[];
  const assigned = new Set((overview?.handlers ?? []).filter((h) => h.active).map((h) => h.user_id));
  const email = resolveEmailProvider(process.env);
  const enabled = rasaEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Ruang Rasa</h1>
        <p className="text-sm text-slate-600">Pelaporan perundungan/kekerasan oleh siswa. Pengaturan petugas dan kebijakan ada di sini.</p>
      </div>
      <Alert tone="info">
        <strong>Super Admin tidak dapat membaca isi laporan.</strong> Hanya Guru BK yang ditugaskan di bawah ini yang dapat. Halaman ini hanya menampilkan jumlah
        laporan dan catatan akses (siapa membuka apa dan kapan), tanpa isi.
      </Alert>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold text-navy-900">Status modul</h2>
        <p>Penerimaan laporan: {enabled ? <strong className="text-green-700">aktif</strong> : <strong className="text-red-700">belum aktif</strong>}
          {!enabled && " — isi RASA_ENCRYPTION_KEY dan SUPABASE_SERVICE_ROLE_KEY di server (lihat panduan Ruang Rasa)."}</p>
        <p>Email pemberitahuan ke petugas: {email.configured ? <strong className="text-green-700">aktif</strong> : <strong className="text-amber-700">belum aktif</strong>}
          {!email.configured && " — petugas tetap melihat laporan baru di dashboard BK, tetapi tidak menerima email."}</p>
        <p>Petugas aktif: <strong>{assigned.size}</strong>{assigned.size === 0 && <span className="text-red-700"> — tanpa petugas, tidak ada yang dapat membaca laporan masuk.</span>}</p>
      </section>

      {overview && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Laporan baru", value: overview.counts.baru }, { label: "Sedang diproses", value: overview.counts.diproses },
            { label: "Mendesak (belum selesai)", value: overview.counts.mendesak_terbuka }, { label: "Selesai (menunggu dihapus)", value: overview.counts.selesai },
          ].map((s) => (
            <div key={s.label} className="card"><p className="text-sm text-slate-500">{s.label}</p><p className="mt-1 text-3xl font-bold text-navy-900">{s.value}</p></div>
          ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-900">Petugas Ruang Rasa</h2>
        <p className="text-sm text-slate-600">Hanya akun Guru BK yang aktif yang dapat ditugaskan. Beri peran Guru BK di <a href="/admin/pengguna" className="text-teal-700 underline">Pengguna</a> bila belum ada.</p>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada akun Guru BK aktif.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-medium">{a.full_name ?? "(tanpa nama)"} {assigned.has(a.id) && <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">Petugas</span>}</span>
                <ActionForm action={setRasaHandlerAction} submitLabel={assigned.has(a.id) ? "Cabut penugasan" : "Tugaskan"} className="" submitClassName={assigned.has(a.id) ? "btn-secondary !px-3 !py-1 text-xs" : "btn-primary !px-3 !py-1 text-xs"}>
                  <input type="hidden" name="userId" value={a.id} />
                  <input type="hidden" name="enabled" value={assigned.has(a.id) ? "0" : "1"} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-900">Kebijakan</h2>
        <ActionForm action={saveRasaSettingsAction} submitLabel="Simpan kebijakan" submitClassName="btn-primary">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label htmlFor="months" className="label">Masa simpan laporan selesai (bulan)</label>
              <input id="months" name="months" type="number" min={3} max={60} required defaultValue={settings?.rasa_retention_months ?? 12} className="input" />
              <p className="mt-1 text-xs text-slate-500">Setelah masa ini, laporan yang sudah selesai (beserta percakapannya) dihapus permanen secara otomatis oleh penjadwal.</p>
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="notice" className="label">Catatan prosedur darurat sekolah (tampil di formulir siswa)</label>
              <textarea id="notice" name="notice" rows={4} maxLength={1000} defaultValue={settings?.rasa_notice ?? ""} className="input"
                placeholder="Tulis prosedur resmi sekolah, mis. siapa yang dihubungi bila ada ancaman keselamatan. Kosongkan bila belum ada." />
              <p className="mt-1 text-xs text-slate-500">Isi sesuai prosedur resmi sekolah. Sistem tidak membuat prosedur sendiri.</p>
            </div>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="font-semibold text-navy-900">Catatan akses (100 terakhir)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pr-3">Waktu</th><th className="py-2 pr-3">Petugas</th><th className="py-2 pr-3">Tindakan</th><th className="py-2">Kode laporan</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(overview?.log ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-600">{formatWaktuWita(l.created_at)}</td>
                  <td className="py-2 pr-3">{l.actor_name ?? <span className="text-slate-500">Sistem</span>}</td>
                  <td className="py-2 pr-3">{describe(l.action)}</td>
                  <td className="py-2 font-mono text-xs">{l.reference_code ?? "(sudah dihapus)"}</td>
                </tr>
              ))}
              {(overview?.log ?? []).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">Belum ada aktivitas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
