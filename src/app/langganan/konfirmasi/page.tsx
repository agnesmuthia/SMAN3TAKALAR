import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/alert";
import { confirmAction } from "../token-actions";

export const metadata: Metadata = {
  title: "Konfirmasi langganan",
  robots: { index: false },
  referrer: "no-referrer",
};

export default async function KonfirmasiPage({ searchParams }: PageProps<"/langganan/konfirmasi">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  return (
    <AuthCard title="Konfirmasi langganan berita">
      {token ? (
        <ActionForm action={confirmAction} submitLabel="Ya, saya ingin berlangganan" hideOnSuccess>
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-slate-600">
            Klik tombol di bawah untuk mengaktifkan langganan berita sekolah ke alamat email Anda.
          </p>
        </ActionForm>
      ) : (
        <Alert tone="error">Tautan konfirmasi tidak lengkap.</Alert>
      )}
    </AuthCard>
  );
}
