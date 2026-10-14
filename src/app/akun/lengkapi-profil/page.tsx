import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { AuthCard } from "@/components/auth-card";
import { hasOpenVerificationRequest, requireUser } from "@/lib/auth/dal";
import { homeForRole } from "@/lib/auth/routing";
import { submitVerificationAction } from "../actions";

export const metadata: Metadata = { title: "Lengkapi profil" };

export default async function LengkapiProfilPage() {
  const ctx = await requireUser("/akun/lengkapi-profil");
  if (ctx.profile?.status === "active" && ctx.profile.role) redirect(homeForRole(ctx.profile.role));
  if (await hasOpenVerificationRequest(ctx)) redirect("/akun/menunggu");

  return (
    <AuthCard title="Lengkapi profil" subtitle="Langkah wajib sebelum mengakses layanan warga sekolah.">
      <Alert tone="info">
        Data ini dicocokkan dengan data sekolah dan diverifikasi admin. Isi nama sesuai data resmi sekolah, bukan
        nama akun Google. Peran Guru BK dan admin hanya ditetapkan oleh admin.
      </Alert>
      <ActionForm action={submitVerificationAction} submitLabel="Kirim untuk verifikasi">
        <fieldset>
          <legend className="label">Saya adalah</legend>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="claimedRole" value="guru" required /> Guru</label>
            <label className="flex items-center gap-2"><input type="radio" name="claimedRole" value="siswa" /> Siswa</label>
          </div>
        </fieldset>
        <div>
          <label htmlFor="fullName" className="label">Nama lengkap sesuai data sekolah</label>
          <input id="fullName" name="fullName" required minLength={2} maxLength={120} autoComplete="name" className="input" />
        </div>
        <div>
          <label htmlFor="identifier" className="label">NIP (guru) atau NIS/NISN (siswa)</label>
          <input id="identifier" name="identifier" required inputMode="numeric" pattern="[0-9]{4,20}" autoComplete="off" className="input" />
        </div>
        <div>
          <label htmlFor="className" className="label">Kelas (khusus siswa, mis. X-1)</label>
          <input id="className" name="className" maxLength={40} autoComplete="off" className="input" />
        </div>
      </ActionForm>
      <p className="text-xs text-slate-500">
        NIP/NIS hanya dapat dilihat oleh Anda dan admin berwenang, dan tidak dikirim ke Google.
      </p>
    </AuthCard>
  );
}
