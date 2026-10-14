import { ActionForm } from "@/components/action-form";
import { ImageField } from "@/components/cms/image-field";
import { ACHIEVEMENT_LEVELS, ACHIEVEMENT_LEVEL_LABEL, type AchievementLevel } from "@/lib/content/labels";
import { saveAchievementAction } from "../konten/actions";

export type AchievementValues = {
  id: string;
  title: string;
  recipient: string | null;
  level: AchievementLevel;
  organizer: string | null;
  achieved_on: string;
  description: string;
  image_url: string | null;
  news_id: string | null;
  is_published: boolean;
};

export function AchievementForm({ values, news }: { values?: AchievementValues; news: { id: string; title: string }[] }) {
  const v = values;
  return (
    <ActionForm action={saveAchievementAction} submitLabel={v ? "Simpan perubahan" : "Tambah prestasi"} submitClassName="btn-primary">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="a-title">Nama prestasi / lomba</label>
            <input id="a-title" name="title" required minLength={3} maxLength={200} defaultValue={v?.title} className="input" placeholder="Contoh: Juara 1 Lomba Debat Bahasa Inggris" />
          </div>
          <div>
            <label className="label" htmlFor="a-recipient">Penerima (opsional)</label>
            <input id="a-recipient" name="recipient" maxLength={200} defaultValue={v?.recipient ?? ""} className="input" placeholder="Nama siswa, tim, atau guru" />
            <p className="mt-1 text-xs text-slate-500">Nama siswa tampil publik. Isi hanya bila siswa/orang tua sudah mengizinkan; bila ragu, tulis nama tim atau kelas.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="a-level">Tingkat</label>
              <select id="a-level" name="level" required defaultValue={v?.level ?? "kabupaten"} className="input">
                {ACHIEVEMENT_LEVELS.map((l) => <option key={l} value={l}>{ACHIEVEMENT_LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="a-date">Tanggal</label>
              <input id="a-date" name="achievedOn" type="date" required defaultValue={v?.achieved_on} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="a-org">Penyelenggara (opsional)</label>
            <input id="a-org" name="organizer" maxLength={200} defaultValue={v?.organizer ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a-desc">Keterangan (opsional)</label>
            <textarea id="a-desc" name="description" rows={4} maxLength={2000} defaultValue={v?.description} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a-news">Berita terkait (opsional)</label>
            <select id="a-news" name="newsId" defaultValue={v?.news_id ?? ""} className="input">
              <option value="">Tidak ada</option>
              {news.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={v?.is_published ?? false} /> Tampilkan di website</label>
        </div>
        <ImageField label="Foto prestasi (opsional)" current={v?.image_url ?? null} />
      </div>
    </ActionForm>
  );
}
