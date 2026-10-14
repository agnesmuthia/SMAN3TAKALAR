import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { AuthCard, Divider } from "@/components/auth-card";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { signInAction } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/auth/redirect";
import { authErrorMessage } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Masuk" };

export default async function MasukPage({ searchParams }: PageProps<"/masuk">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const error = authErrorMessage(sp.error);

  return (
    <AuthCard title="Masuk" subtitle="Untuk guru, siswa, dan staf sekolah.">
      {error && <Alert tone="error">{error}</Alert>}
      <GoogleAuthButton label="Lanjutkan dengan Google" next={next} />
      <Divider />
      <ActionForm action={signInAction} submitLabel="Masuk">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Kata sandi</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
      </ActionForm>
      <div className="flex justify-between text-sm">
        <Link href="/lupa-password" className="text-brand-700 hover:underline">Lupa kata sandi?</Link>
        <Link href="/daftar" className="text-brand-700 hover:underline">Belum punya akun? Daftar</Link>
      </div>
      <p className="text-xs text-slate-500">
        Berita sekolah dapat dibaca tanpa masuk. Masuk hanya diperlukan untuk layanan warga sekolah.
      </p>
    </AuthCard>
  );
}
