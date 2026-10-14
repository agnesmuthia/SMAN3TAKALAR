import type { Metadata } from "next";
import { Alert } from "@/components/alert";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { requireUser } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { ROLE_LABEL, STATUS_LABEL } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunPage({ searchParams }: PageProps<"/akun">) {
  const ctx = await requireUser("/akun");
  const sp = await searchParams;
  const error = authErrorMessage(sp.error);
  const providers = new Set((ctx.user.identities ?? []).map((i) => i.provider));
  const profile = ctx.profile;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand-900">Pengaturan akun</h1>
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      <dl className="card mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{ctx.user.email}</dd></div>
        <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{profile ? STATUS_LABEL[profile.status] : "-"}</dd></div>
        <div><dt className="text-slate-500">Peran</dt><dd className="font-medium">{profile?.role ? ROLE_LABEL[profile.role] : "Belum ditetapkan"}</dd></div>
        <div><dt className="text-slate-500">Nama (data sekolah)</dt><dd className="font-medium">{profile?.full_name ?? "-"}</dd></div>
      </dl>

      <section className="card mt-6 space-y-3">
        <h2 className="text-lg font-semibold">Metode masuk</h2>
        <ul className="text-sm text-slate-700">
          <li>Email &amp; kata sandi: {providers.has("email") ? "aktif" : "tidak dipakai"}</li>
          <li>Google: {providers.has("google") ? "tertaut" : "belum tertaut"}</li>
        </ul>
        {!providers.has("google") && (
          <>
            <p className="text-sm text-slate-600">
              Tautkan akun Google agar dapat masuk tanpa kata sandi. Anda sudah membuktikan kepemilikan akun ini
              dengan masuk terlebih dahulu. Menautkan Google tidak mengubah peran Anda.
            </p>
            <GoogleAuthButton label="Tautkan akun Google" mode="link" next="/akun" />
          </>
        )}
      </section>

      <form action="/auth/keluar" method="post" className="mt-6">
        <button type="submit" className="btn-secondary">Keluar</button>
      </form>
    </div>
  );
}
