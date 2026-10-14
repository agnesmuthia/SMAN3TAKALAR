import { redirect } from "next/navigation";
import { hasOpenVerificationRequest, requireUser } from "@/lib/auth/dal";
import { resolvePostLoginDestination } from "@/lib/auth/routing";

// Mengarahkan ke dashboard sesuai peran (atau ke verifikasi bila pending).
export default async function DashboardRedirect() {
  const ctx = await requireUser("/dashboard");
  const profile = ctx.profile;
  redirect(
    resolvePostLoginDestination(
      profile
        ? { role: profile.role, status: profile.status, hasOpenVerificationRequest: await hasOpenVerificationRequest(ctx) }
        : null,
      null,
    ),
  );
}
