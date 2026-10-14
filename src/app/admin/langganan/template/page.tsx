import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth/dal";
import { saveTemplateAction } from "../../actions";
import { LanggananNav } from "../subnav";

export const metadata: Metadata = { title: "Template email" };

type Template = {
  id: string;
  name: string;
  heading: string;
  intro: string;
  footer_note: string;
  accent_color: string;
  is_default: boolean;
};

export default async function TemplatePage() {
  const ctx = await requireRole(["admin"], "/admin/langganan/template");
  const { data } = await ctx.supabase
    .from("newsletter_templates")
    .select("id, name, heading, intro, footer_note, accent_color, is_default")
    .order("is_default", { ascending: false });
  const templates = (data ?? []) as Template[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-900">Template email</h1>
        <LanggananNav />
      </div>
      <p className="text-sm text-slate-600">
        Logo dan nama sekolah diambil dari konfigurasi situs. Tautan berhenti berlangganan selalu ditambahkan
        otomatis di setiap email dan tidak dapat dihapus.
      </p>
      {templates.map((t) => (
        <section key={t.id} className="card">
          <ActionForm action={saveTemplateAction} submitLabel="Simpan template" submitClassName="btn-primary">
            <input type="hidden" name="id" value={t.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`name-${t.id}`}>Nama template{t.is_default ? " (bawaan)" : ""}</label>
                <input id={`name-${t.id}`} name="name" defaultValue={t.name} required className="input" />
              </div>
              <div>
                <label className="label" htmlFor={`accent-${t.id}`}>Warna aksen</label>
                <input id={`accent-${t.id}`} name="accentColor" type="color" defaultValue={t.accent_color} className="h-10 w-20" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor={`heading-${t.id}`}>Judul buletin bawaan</label>
              <input id={`heading-${t.id}`} name="heading" defaultValue={t.heading} required maxLength={120} className="input" />
            </div>
            <div>
              <label className="label" htmlFor={`intro-${t.id}`}>Pengantar bawaan</label>
              <textarea id={`intro-${t.id}`} name="intro" defaultValue={t.intro} maxLength={1000} rows={3} className="input" />
            </div>
            <div>
              <label className="label" htmlFor={`footer-${t.id}`}>Catatan kaki</label>
              <textarea id={`footer-${t.id}`} name="footerNote" defaultValue={t.footer_note} maxLength={500} rows={2} className="input" />
            </div>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
