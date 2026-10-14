import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { ImageField } from "@/components/cms/image-field";
import { requireNewsPublisher } from "@/lib/auth/dal";
import type { SiteProfile } from "@/lib/content/site-profile";
import { saveSiteProfileAction } from "../konten/actions";

export const metadata: Metadata = { title: "Profil Sekolah" };

const TEXT_FIELDS: { name: keyof SiteProfile; label: string; type?: string; placeholder?: string }[] = [
  { name: "address", label: "Alamat lengkap" },
  { name: "phone", label: "Telepon" },
  { name: "email", label: "Email resmi", type: "email" },
  { name: "whatsapp", label: "WhatsApp (angka, mis. +6281234567890)" },
  { name: "maps_url", label: "Tautan Google Maps (https://…)", type: "url" },
  { name: "instagram_url", label: "Instagram (https://…)", type: "url" },
  { name: "facebook_url", label: "Facebook (https://…)", type: "url" },
  { name: "youtube_url", label: "YouTube (https://…)", type: "url" },
  { name: "tiktok_url", label: "TikTok (https://…)", type: "url" },
];

export default async function ProfilSekolahPage() {
  const ctx = await requireNewsPublisher("/admin/profil-sekolah");
  const { data } = await ctx.supabase.from("site_profile").select("*").maybeSingle<SiteProfile>();
  const p = data ?? ({} as Partial<SiteProfile>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Profil Sekolah</h1>
        <p className="text-sm text-slate-600">
          Identitas, kontak resmi, dan media sosial yang tampil di header, beranda, dan footer. Isi hanya dengan data
          resmi; kolom yang kosong tidak ditampilkan.
        </p>
      </div>
      <ActionForm action={saveSiteProfileAction} submitLabel="Simpan profil sekolah" className="space-y-6" submitClassName="btn-primary">
        <section className="card space-y-4">
          <h2 className="font-semibold text-navy-900">Beranda</h2>
          <div>
            <label htmlFor="hero_title" className="label">Judul hero (kosongkan untuk memakai nama sekolah)</label>
            <input id="hero_title" name="hero_title" maxLength={120} defaultValue={p.hero_title ?? ""} className="input" />
          </div>
          <div>
            <label htmlFor="hero_subtitle" className="label">Kalimat pembuka hero</label>
            <textarea id="hero_subtitle" name="hero_subtitle" rows={2} maxLength={300} defaultValue={p.hero_subtitle ?? ""} className="input" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <ImageField label="Logo resmi sekolah" current={p.logo_url ?? null} fileName="logoFile" removeName="removeLogo" hint="Gunakan logo resmi berlatar transparan (PNG). Maks. 5 MB." />
            <ImageField label="Foto hero beranda" current={p.hero_image_url ?? null} fileName="heroFile" removeName="removeHero" hint="Foto asli sekolah yang boleh dipublikasikan, orientasi mendatar. Maks. 5 MB." />
          </div>
        </section>
        <section className="card space-y-4">
          <h2 className="font-semibold text-navy-900">Kontak & media sosial</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <div key={f.name} className={f.name === "address" ? "sm:col-span-2" : ""}>
                <label htmlFor={f.name} className="label">{f.label}</label>
                <input id={f.name} name={f.name} type={f.type ?? "text"} defaultValue={(p[f.name] as string | null) ?? ""} className="input" />
              </div>
            ))}
          </div>
        </section>
      </ActionForm>
    </div>
  );
}
