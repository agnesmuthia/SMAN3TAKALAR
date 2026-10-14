import type { Metadata } from "next";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "Tulis pengumuman" };

export default async function PengumumanBaruPage() {
  await requireNewsPublisher("/admin/pengumuman/baru");
  return (
    <div className="card space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Tulis pengumuman</h1>
      <AnnouncementForm />
    </div>
  );
}
