import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/alert";
import { requireUser } from "@/lib/auth/dal";
import { homeForRole } from "@/lib/auth/routing";

export const metadata: Metadata = { title: "Menunggu verifikasi" };

export default async function MenungguPage() {
  const ctx = await requireUser("/akun/menunggu");
  if (ctx.profile?.status === "active" && ctx.profile.role) redirect(homeForRole(ctx.profile.role));

  const { data: request } = await ctx.supabase
    .from("verification_requests")
    .select("status, reviewer_note, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string; reviewer_note: string | null; created_at: string }>();

  if (!request) redirect("/akun/lengkapi-profil");

  return (
    <AuthCard title="Menunggu verifikasi">
      {request.status === "rejected" ? (
        <>
          <Alert tone="warning">
            Permintaan verifikasi Anda belum dapat disetujui.
            {request.reviewer_note ? ` Catatan admin: ${request.reviewer_note}` : ""}
          </Alert>
          <Link href="/akun/lengkapi-profil" className="btn-primary w-full">Ajukan ulang</Link>
        </>
      ) : (
        <Alert tone="info">
          Profil Anda sedang ditinjau admin sekolah. Selama menunggu, fitur khusus guru/siswa belum dapat diakses.
          Berita sekolah tetap dapat dibaca di halaman Berita.
        </Alert>
      )}
      <div className="flex justify-between text-sm">
        <Link href="/akun" className="text-brand-700 hover:underline">Pengaturan akun</Link>
        <Link href="/berita" className="text-brand-700 hover:underline">Baca berita</Link>
      </div>
    </AuthCard>
  );
}
