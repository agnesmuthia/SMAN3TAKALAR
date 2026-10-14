import { ActionForm } from "@/components/action-form";
import type { Announcement } from "@/lib/dashboard/data";
import { formatTanggal } from "@/lib/site";
import { markAnnouncementReadAction } from "@/app/dashboard/actions";

const AUDIENCE_LABEL: Record<string, string> = { publik: "Publik", semua: "Semua", guru: "Guru", siswa: "Siswa", guru_bk: "Guru BK" };

export function AnnouncementList({ items, emptyText = "Belum ada pengumuman." }: { items: Announcement[]; emptyText?: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-600">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className={`card !p-4 ${a.read ? "" : "border-l-4 !border-l-brand-600"}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <time dateTime={a.published_at}>{formatTanggal(a.published_at)}</time>
            <span className="rounded bg-slate-100 px-2 py-0.5">{AUDIENCE_LABEL[a.audience] ?? a.audience}</span>
            {!a.read && <span className="rounded bg-brand-100 px-2 py-0.5 font-semibold text-brand-800">Baru</span>}
          </div>
          <h3 className="mt-1 font-semibold text-slate-900">{a.title}</h3>
          {a.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.body}</p>}
          {!a.read && (
            <ActionForm action={markAnnouncementReadAction} submitLabel="Tandai sudah dibaca" className="mt-2" submitClassName="text-xs font-semibold text-brand-700 hover:underline">
              <input type="hidden" name="announcementId" value={a.id} />
            </ActionForm>
          )}
        </li>
      ))}
    </ul>
  );
}
