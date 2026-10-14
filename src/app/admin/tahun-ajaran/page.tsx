import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireSchoolAdmin } from "@/lib/auth/dal";
import { TERM_LABEL } from "@/lib/school/labels";
import { formatTanggalSaja } from "@/lib/site";
import {
  deleteAcademicYearAction,
  deleteSemesterAction,
  saveAcademicYearAction,
  saveSemesterAction,
  setActiveSemesterAction,
} from "../sekolah/actions";

export const metadata: Metadata = { title: "Tahun Ajaran & Semester" };

type Semester = { id: string; term: number; starts_on: string; ends_on: string; is_active: boolean };
type Year = { id: string; name: string; starts_on: string; ends_on: string; is_active: boolean; semesters: Semester[] };

function YearFields({ y }: { y?: Year }) {
  const k = y?.id ?? "baru";
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor={`n-${k}`}>Tahun ajaran</label>
        <input id={`n-${k}`} name="name" required pattern="\d{4}/\d{4}" placeholder="2026/2027" defaultValue={y?.name} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`s-${k}`}>Mulai</label>
        <input id={`s-${k}`} name="startsOn" type="date" required defaultValue={y?.starts_on} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`e-${k}`}>Selesai</label>
        <input id={`e-${k}`} name="endsOn" type="date" required defaultValue={y?.ends_on} className="input" />
      </div>
    </div>
  );
}

function SemesterFields({ yearId, s }: { yearId: string; s?: Semester }) {
  const k = s?.id ?? `baru-${yearId}`;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="academicYearId" value={yearId} />
      <div>
        <label className="label" htmlFor={`t-${k}`}>Semester</label>
        <select id={`t-${k}`} name="term" defaultValue={s?.term ?? 1} className="input">
          <option value={1}>Ganjil</option>
          <option value={2}>Genap</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`ss-${k}`}>Mulai</label>
        <input id={`ss-${k}`} name="startsOn" type="date" required defaultValue={s?.starts_on} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`se-${k}`}>Selesai</label>
        <input id={`se-${k}`} name="endsOn" type="date" required defaultValue={s?.ends_on} className="input" />
      </div>
    </div>
  );
}

export default async function TahunAjaranPage() {
  const ctx = await requireSchoolAdmin("/admin/tahun-ajaran");
  const { data } = await ctx.supabase
    .from("academic_years")
    .select("id, name, starts_on, ends_on, is_active, semesters (id, term, starts_on, ends_on, is_active)")
    .order("starts_on", { ascending: false });
  const years = ((data ?? []) as Year[]).map((y) => ({ ...y, semesters: [...y.semesters].sort((a, b) => a.term - b.term) }));
  const active = years.flatMap((y) => y.semesters.map((s) => ({ ...s, year: y.name }))).find((s) => s.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Tahun Ajaran & Semester</h1>
        <p className="text-sm text-slate-600">
          Semester aktif menentukan jadwal yang dilihat siswa dan guru. Jadwal semester lain tetap tersimpan.
        </p>
      </div>
      <section className={`card ${active ? "border-l-4 !border-l-teal-600" : "border-l-4 !border-l-gold-500"}`}>
        {active ? (
          <p className="text-sm"><span className="font-semibold text-navy-900">Semester aktif:</span> {active.year} · Semester {TERM_LABEL[active.term]} ({formatTanggalSaja(active.starts_on)} – {formatTanggalSaja(active.ends_on)})</p>
        ) : (
          <p className="text-sm text-slate-700">Belum ada semester aktif. Tambahkan tahun ajaran dan semester, lalu klik <strong>Jadikan aktif</strong>.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-900">Tambah tahun ajaran</h2>
        <ActionForm action={saveAcademicYearAction} submitLabel="Tambah tahun ajaran" submitClassName="btn-primary">
          <YearFields />
        </ActionForm>
      </section>

      {years.map((y) => (
        <section key={y.id} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-navy-900">Tahun ajaran {y.name}</h2>
            {y.is_active && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">Aktif</span>}
          </div>

          <ul className="space-y-3">
            {y.semesters.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-navy-900">
                    Semester {TERM_LABEL[s.term]} <span className="font-normal text-slate-600">· {formatTanggalSaja(s.starts_on)} – {formatTanggalSaja(s.ends_on)}</span>
                  </p>
                  {s.is_active ? (
                    <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">Semester aktif</span>
                  ) : (
                    <ActionForm action={setActiveSemesterAction} submitLabel="Jadikan aktif" className="" submitClassName="btn-secondary !px-3 !py-1 text-xs">
                      <input type="hidden" name="id" value={s.id} />
                    </ActionForm>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-teal-700">Ubah atau hapus</summary>
                  <div className="mt-3 space-y-3">
                    <ActionForm action={saveSemesterAction} submitLabel="Simpan semester" submitClassName="btn-secondary">
                      <input type="hidden" name="id" value={s.id} />
                      <SemesterFields yearId={y.id} s={s} />
                    </ActionForm>
                    {!s.is_active && (
                      <ActionForm action={deleteSemesterAction} submitLabel="Hapus semester" className="flex flex-wrap items-center gap-3" submitClassName="btn-danger !px-3 !py-1 text-xs">
                        <input type="hidden" name="id" value={s.id} />
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin (hanya bisa bila semester belum punya jadwal)</label>
                      </ActionForm>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>

          {y.semesters.length < 2 && (
            <div className="rounded-xl bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-navy-900">Tambah semester</h3>
              <ActionForm action={saveSemesterAction} submitLabel="Tambah semester" submitClassName="btn-primary">
                <SemesterFields yearId={y.id} />
              </ActionForm>
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm text-teal-700">Ubah atau hapus tahun ajaran</summary>
            <div className="mt-3 space-y-3">
              <ActionForm action={saveAcademicYearAction} submitLabel="Simpan tahun ajaran" submitClassName="btn-secondary">
                <input type="hidden" name="id" value={y.id} />
                <YearFields y={y} />
              </ActionForm>
              {y.semesters.length === 0 && (
                <ActionForm action={deleteAcademicYearAction} submitLabel="Hapus tahun ajaran" className="flex flex-wrap items-center gap-3" submitClassName="btn-danger !px-3 !py-1 text-xs">
                  <input type="hidden" name="id" value={y.id} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin</label>
                </ActionForm>
              )}
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
