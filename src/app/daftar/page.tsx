import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { AuthCard, Divider } from "@/components/auth-card";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { signUpAction } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Daftar" };

export default function DaftarPage() {
  return (
    <AuthCard title="Daftar akun warga sekolah" subtitle="Untuk guru dan siswa.">
      <Alert tone="info">
        Mendaftar (termasuk dengan Google) <strong>tidak</strong> langsung memberi akses guru atau siswa. Setelah
        mendaftar, lengkapi profil dengan NIP/NIS untuk diverifikasi admin sekolah.
      </Alert>
      <GoogleAuthButton label="Daftar dengan Google" next="/akun/lengkapi-profil" />
      <Divider />
      <ActionForm action={signUpAction} submitLabel="Daftar dengan email" hideOnSuccess>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Kata sandi (min. 8 karakter)</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label htmlFor="passwordConfirm" className="label">Ulangi kata sandi</label>
          <input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </div>
      </ActionForm>
      <p className="text-sm">
        Sudah punya akun? <Link href="/masuk" className="text-brand-700 hover:underline">Masuk</Link>
      </p>
      <p className="text-xs text-slate-500">
        Ingin menerima berita sekolah lewat email? Langganan dilakukan terpisah melalui formulir di bagian bawah
        halaman dan tidak memerlukan akun.
      </p>
    </AuthCard>
  );
}
