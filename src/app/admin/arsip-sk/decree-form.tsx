import { ActionForm } from "@/components/action-form";
import { saveDecreeAction } from "../sekolah/actions";

export type DecreeValues = {
  id: string;
  number: string;
  title: string;
  issued_on: string;
  issuer: string | null;
  academic_year_id: string | null;
  status: "berlaku" | "arsip";
  visibility: "public" | "internal";
  is_published: boolean;
  verified_at: string | null;
  file_size: number;
};

const pdfInputClass =
  "block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white";

export function DecreeForm({ values, years }: { values?: DecreeValues; years: { id: string; name: string }[] }) {
  const v = values;
  return (
    <ActionForm action={saveDecreeAction} submitLabel={v ? "Simpan perubahan" : "Simpan SK"} pendingLabel="Mengunggah…" submitClassName="btn-primary">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="d-number">Nomor SK</label>
            <input id="d-number" name="number" required maxLength={120} defaultValue={v?.number} className="input font-mono" placeholder="Sesuai yang tertulis di SK" />
          </div>
          <div>
            <label className="label" htmlFor="d-title">Perihal / judul</label>
            <textarea id="d-title" name="title" required minLength={3} maxLength={300} rows={2} defaultValue={v?.title} className="input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="d-date">Tanggal ditetapkan</label>
              <input id="d-date" name="issuedOn" type="date" required defaultValue={v?.issued_on} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="d-year">Tahun ajaran (opsional)</label>
              <select id="d-year" name="academicYearId" defaultValue={v?.academic_year_id ?? ""} className="input">
                <option value="">—</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="d-issuer">Ditetapkan oleh (opsional)</label>
            <input id="d-issuer" name="issuer" maxLength={150} defaultValue={v?.issuer ?? ""} className="input" placeholder="mis. Kepala Sekolah" />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="d-file">{v ? "Ganti file PDF (opsional)" : "File PDF SK"}</label>
            <input id="d-file" name="file" type="file" accept="application/pdf,.pdf" required={!v} className={pdfInputClass} />
            <p className="mt-1 text-xs text-slate-500">PDF maks. 10 MB. File disimpan privat; pengunjung hanya mendapat tautan sementara bila SK ditampilkan untuk mereka.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="d-status">Status</label>
              <select id="d-status" name="status" defaultValue={v?.status ?? "berlaku"} className="input">
                <option value="berlaku">Masih berlaku</option>
                <option value="arsip">Arsip (tidak berlaku)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-vis">Dapat dilihat oleh</label>
              <select id="d-vis" name="visibility" defaultValue={v?.visibility ?? "internal"} className="input">
                <option value="internal">Internal (guru &amp; siswa terverifikasi)</option>
                <option value="public">Publik (semua pengunjung)</option>
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-3 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="verified" defaultChecked={Boolean(v?.verified_at)} className="mt-1" />
              <span>
                Saya sudah memeriksa bahwa isi PDF sesuai dengan nomor, tanggal, dan perihal di atas, serta boleh dibagikan kepada pihak yang dipilih.
                SK yang memuat data pribadi (NIK, alamat, nilai) sebaiknya <strong>internal</strong>.
              </span>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={v?.is_published ?? false} /> Tampilkan di halaman Arsip SK</label>
        </div>
      </div>
    </ActionForm>
  );
}
