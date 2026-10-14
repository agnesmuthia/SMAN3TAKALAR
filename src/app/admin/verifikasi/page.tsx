import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth/dal";
import { formatTanggal } from "@/lib/site";
import { ROLE_LABEL, type UserRole } from "@/lib/auth/types";
import { reviewVerificationAction } from "../actions";

export const metadata: Metadata = { title: "Verifikasi peran" };

type Request = {
  id: string;
  claimed_role: UserRole;
  full_name: string;
  identifier: string;
  class_name: string | null;
  roster_match: boolean;
  email_domain_match: boolean;
  created_at: string;
};

export default async function VerifikasiPage() {
  const ctx = await requireRole(["admin"], "/admin/verifikasi");
  const { data } = await ctx.supabase
    .from("verification_requests")
    .select("id, claimed_role, full_name, identifier, class_name, roster_match, email_domain_match, created_at")
    .eq("status", "submitted")
    .order("created_at")
    .limit(100);
  const requests = (data ?? []) as Request[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Verifikasi peran guru/siswa</h1>
        <p className="mt-1 text-sm text-slate-600">
          Login Google atau email hanya membuktikan pemilik akun. Setujui hanya bila data cocok dengan data
          resmi sekolah. Indikator di bawah adalah sinyal bantu, bukan keputusan otomatis.
        </p>
      </div>
      {requests.length === 0 && <p className="text-slate-600">Tidak ada permintaan yang menunggu.</p>}
      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="text-sm">
                <p className="text-base font-semibold">{r.full_name}</p>
                <p>Mengaku sebagai: <strong>{ROLE_LABEL[r.claimed_role]}</strong>{r.class_name ? ` · Kelas ${r.class_name}` : ""}</p>
                <p>NIP/NIS: <span className="font-mono">{r.identifier}</span></p>
                <p className="text-slate-500">Diajukan {formatTanggal(r.created_at)}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${r.roster_match ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {r.roster_match ? "Cocok dengan data induk" : "Tidak ditemukan di data induk"}
                  </span>
                  <span className={`rounded px-2 py-0.5 ${r.email_domain_match ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                    {r.email_domain_match ? "Email domain sekolah" : "Email bukan domain sekolah"}
                  </span>
                </div>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <ActionForm action={reviewVerificationAction} submitLabel="Setujui" className="space-y-2" submitClassName="btn-primary w-full">
                  <input type="hidden" name="requestId" value={r.id} />
                  <input type="hidden" name="decision" value="approve" />
                </ActionForm>
                <ActionForm action={reviewVerificationAction} submitLabel="Tolak" className="space-y-2" submitClassName="btn-secondary w-full">
                  <input type="hidden" name="requestId" value={r.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <label className="sr-only" htmlFor={`note-${r.id}`}>Catatan penolakan</label>
                  <input id={`note-${r.id}`} name="note" maxLength={500} placeholder="Catatan untuk pengguna (opsional)" className="input" />
                </ActionForm>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
