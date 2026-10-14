import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { NewsForm } from "../news-form";

export const metadata: Metadata = { title: "Tulis berita" };

export default async function BeritaBaruPage() {
  await requireRole(["admin"], "/admin/berita/baru");
  return (
    <div className="card space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Tulis berita</h1>
      <NewsForm />
    </div>
  );
}
