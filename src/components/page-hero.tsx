import type { ReactNode } from "react";

// Kepala halaman publik yang seragam (judul, eyebrow, deskripsi singkat).
export function PageHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-slate-600">{description}</p>}
        {children}
      </div>
    </section>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="card text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}
