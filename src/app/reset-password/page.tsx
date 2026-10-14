import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth-card";
import { resetPasswordAction } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return (
    <AuthCard title="Atur ulang kata sandi">
      <ActionForm action={resetPasswordAction} submitLabel="Simpan kata sandi baru">
        <div>
          <label htmlFor="password" className="label">Kata sandi baru (min. 8 karakter)</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label htmlFor="passwordConfirm" className="label">Ulangi kata sandi baru</label>
          <input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
