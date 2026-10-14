import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "Tulis pengumuman" };

export default async function PengumumanBaruPage() {
  await requireRole(["admin"], "/admin/pengumuman/baru");
  return (
    <div className="card space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Tulis pengumuman</h1>
      <AnnouncementForm />
    </div>
  );
}
