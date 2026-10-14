import type { Assignment } from "@/lib/dashboard/data";
import { isHttpsUrl } from "@/lib/dashboard/schedule";
import { formatTanggal } from "@/lib/site";

export function AssignmentCard({ item, showClass = false }: { item: Assignment; showClass?: boolean }) {
  const paragraphs = item.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <article className="card !p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold ${item.kind === "tugas" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
          {item.kind === "tugas" ? "Tugas" : "Materi"}
        </span>
        {showClass && <span className="text-slate-500">Kelas {item.class_name}</span>}
        {item.due_at && <span className="text-slate-600">Tenggat {formatTanggal(item.due_at)}</span>}
      </div>
      <h3 className="mt-2 font-semibold text-slate-900">{item.title}</h3>
      {paragraphs.map((p, i) => <p key={i} className="mt-1 whitespace-pre-line text-sm text-slate-700">{p}</p>)}
      {item.link_url && isHttpsUrl(item.link_url) && (
        <a href={item.link_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
          Buka tautan ↗
        </a>
      )}
    </article>
  );
}
