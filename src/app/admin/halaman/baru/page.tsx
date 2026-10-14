import type { Metadata } from "next";
import Link from "next/link";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { PageForm } from "../page-form";

export const metadata: Metadata = { title: "Tambah Halaman" };

export default async function HalamanBaruPage() {
  await requireNewsPublisher("/admin/halaman/baru");
  return (
    <div className="space-y-4">
      <Link href="/admin/halaman" className="text-sm text-teal-700 hover:underline">← Halaman</Link>
      <h1 className="text-2xl font-bold text-navy-900">Tambah Halaman</h1>
      <PageForm values={{ title: "", slug: "", summary: "", contentHtml: "", position: 0, isPublished: false }} />
    </div>
  );
}
