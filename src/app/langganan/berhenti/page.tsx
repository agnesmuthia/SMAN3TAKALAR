import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/alert";
import { parseUnsubscribeToken } from "@/lib/newsletter/service";
import { unsubscribeAction } from "../token-actions";

export const metadata: Metadata = {
  title: "Berhenti berlangganan",
  robots: { index: false },
  referrer: "no-referrer",
};

export default async function BerhentiPage({ searchParams }: PageProps<"/langganan/berhenti">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  let valid = false;
  try {
    valid = Boolean(parseUnsubscribeToken(token));
  } catch {
    valid = false;
  }

  return (
    <AuthCard title="Berhenti berlangganan">
      {valid ? (
        <ActionForm action={unsubscribeAction} submitLabel="Berhenti berlangganan" submitClassName="btn-danger w-full" hideOnSuccess>
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-slate-600">
            Anda tidak perlu masuk ke akun. Setelah berhenti, alamat ini tidak akan menerima buletin berikutnya.
            Anda dapat berlangganan kembali kapan saja melalui website.
          </p>
        </ActionForm>
      ) : (
        <Alert tone="error">Tautan berhenti berlangganan tidak valid.</Alert>
      )}
    </AuthCard>
  );
}
