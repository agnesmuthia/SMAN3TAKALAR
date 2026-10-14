import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth/dal";
import { formatTanggal } from "@/lib/site";
import { createCampaignAction } from "../../actions";
import { LanggananNav } from "../subnav";
import { CAMPAIGN_STATUS_LABEL } from "./labels";

export const metadata: Metadata = { title: "Kampanye buletin" };

export default async function KampanyePage() {
  const ctx = await requireRole(["admin"], "/admin/langganan/kampanye");
  const db = ctx.supabase;

  const [{ data: campaigns }, { data: news }, { data: templates }] = await Promise.all([
    db.from("newsletter_campaigns").select("id, subject, status, mode, created_at, finished_at").order("created_at", { ascending: false }).limit(50),
    // Hanya berita yang lolos aturan distribusi yang ditawarkan.
    db
      .from("news")
      .select("id, title, published_at")
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("newsletter_eligible", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(30),
    db.from("newsletter_templates").select("id, name, is_default").order("is_default", { ascending: false }),
  ]);

  const campaignRows = (campaigns ?? []) as { id: string; subject: string; status: string; mode: string; created_at: string; finished_at: string | null }[];
  const newsRows = (news ?? []) as { id: string; title: string; published_at: string }[];
  const templateRows = (templates ?? []) as { id: string; name: string; is_default: boolean }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-900">Kampanye buletin</h1>
        <LanggananNav />
      </div>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Buat kampanye baru</h2>
        <p className="text-sm text-slate-600">
          Kampanye dibuat sebagai draf dan baru dikirim setelah admin meninjau pratinjau lalu menyetujuinya. Hanya
          berita publik yang sudah terbit yang dapat dipilih; berita draf, internal, dokumen terbatas, dan data
          konseling tidak pernah tersedia di sini.
        </p>
        {newsRows.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada berita publik yang terbit.</p>
        ) : (
          <ActionForm action={createCampaignAction} submitLabel="Buat draf kampanye" submitClassName="btn-primary">
            <div>
              <label htmlFor="subject" className="label">Subjek email</label>
              <input id="subject" name="subject" required minLength={3} maxLength={150} className="input" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="heading" className="label">Judul buletin (opsional)</label>
                <input id="heading" name="heading" maxLength={120} className="input" />
              </div>
              <div>
                <label htmlFor="templateId" className="label">Template</label>
                <select id="templateId" name="templateId" className="input">
                  {templateRows.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_default ? " (bawaan)" : ""}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="intro" className="label">Pengantar (opsional)</label>
              <textarea id="intro" name="intro" maxLength={1000} rows={3} className="input" />
            </div>
            <fieldset>
              <legend className="label">Berita (maks. 10)</legend>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-slate-200 p-3 text-sm">
                {newsRows.map((n) => (
                  <label key={n.id} className="flex items-start gap-2">
                    <input type="checkbox" name="newsIds" value={n.id} className="mt-1" />
                    <span>{n.title} <span className="text-slate-500">· {formatTanggal(n.published_at)}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Histori kampanye</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="px-4 py-2">Subjek</th><th className="px-4 py-2">Mode</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Dibuat</th></tr>
            </thead>
            <tbody>
              {campaignRows.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2"><Link href={`/admin/langganan/kampanye/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.subject}</Link></td>
                  <td className="px-4 py-2">{c.mode === "auto" ? "Otomatis" : "Manual"}</td>
                  <td className="px-4 py-2">{CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}</td>
                  <td className="px-4 py-2">{formatTanggal(c.created_at)}</td>
                </tr>
              ))}
              {campaignRows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Belum ada kampanye.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
