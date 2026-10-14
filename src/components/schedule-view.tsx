import { DAY_LABEL, formatTime, groupByDay, type ScheduleEntry } from "@/lib/dashboard/schedule";

export function ScheduleView({
  entries,
  showClass = false,
  emptyText = "Belum ada jadwal.",
}: {
  entries: ScheduleEntry[];
  showClass?: boolean;
  emptyText?: string;
}) {
  const groups = groupByDay(entries);
  if (groups.length === 0) return <p className="text-sm text-slate-600">{emptyText}</p>;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.day} className="card !p-4">
          <h3 className="font-semibold text-brand-900">{DAY_LABEL[g.day]}</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {g.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-mono text-slate-600">{formatTime(e.start_time)}–{formatTime(e.end_time)}</span>{" "}
                  <strong>{e.subject}</strong>
                  {showClass && <span className="text-slate-600"> · Kelas {e.class_name}</span>}
                </span>
                {e.room && <span className="text-slate-500">Ruang {e.room}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
