import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth-card";
import { forgotPasswordAction } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function LupaPasswordPage() {
  return (
    <AuthCard title="Lupa kata sandi" subtitle="Kami akan mengirim tautan untuk mengatur ulang kata sandi.">
      <ActionForm action={forgotPasswordAction} submitLabel="Kirim tautan" hideOnSuccess>
        <div>
          <label htmlFor="email" className="label">Email akun</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
      </ActionForm>
      <p className="text-sm text-slate-600">
        Akun yang hanya memakai Google tidak memiliki kata sandi; gunakan tombol &quot;Lanjutkan dengan Google&quot;.
      </p>
      <Link href="/masuk" className="text-sm text-brand-700 hover:underline">← Kembali ke halaman masuk</Link>
    </AuthCard>
  );
}
