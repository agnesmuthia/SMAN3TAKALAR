import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth/dal";
import { saveSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function PengaturanPage() {
  const ctx = await requireRole(["admin"], "/admin/pengaturan");
  const { data } = await ctx.supabase
    .from("app_settings")
    .select("newsletter_auto_mode, school_workspace_domain")
    .maybeSingle<{ newsletter_auto_mode: string; school_workspace_domain: string | null }>();

  return (
    <div className="card max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Pengaturan</h1>
      <ActionForm action={saveSettingsAction} submitLabel="Simpan pengaturan" submitClassName="btn-primary">
        <fieldset className="space-y-2">
          <legend className="label">Pengiriman buletin saat berita diterbitkan</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="autoMode" value="off" defaultChecked={(data?.newsletter_auto_mode ?? "off") === "off"} className="mt-1" />
            <span><strong>Nonaktif</strong> (disarankan untuk versi awal): admin menyusun dan menyetujui setiap buletin.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="autoMode" value="draft" defaultChecked={data?.newsletter_auto_mode === "draft"} className="mt-1" />
            <span><strong>Buat draf otomatis</strong>: berita publik yang terbit dibuatkan draf kampanye yang tetap menunggu persetujuan admin.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="autoMode" value="immediate" defaultChecked={data?.newsletter_auto_mode === "immediate"} className="mt-1" />
            <span><strong>Kirim langsung</strong>: berita publik yang terbit langsung dikirim ke pelanggan aktif. Gunakan hanya bila alur persetujuan berita sudah ketat.</span>
          </label>
        </fieldset>
        <div>
          <label htmlFor="workspaceDomain" className="label">Domain Google Workspace sekolah (opsional)</label>
          <input id="workspaceDomain" name="workspaceDomain" defaultValue={data?.school_workspace_domain ?? ""} placeholder="contoh: sman3takalar.sch.id" className="input" />
          <p className="mt-1 text-xs text-slate-500">
            Hanya ditampilkan sebagai sinyal tambahan saat verifikasi; tidak pernah memberi peran secara otomatis.
          </p>
        </div>
      </ActionForm>
    </div>
  );
}
