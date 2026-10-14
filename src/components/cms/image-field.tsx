// Kolom gambar tunggal untuk formulir CMS (tanpa JavaScript).
export function ImageField({
  label,
  current,
  fileName = "imageFile",
  removeName = "removeImage",
  hint = "JPG, PNG, atau WebP, maks. 5 MB. Pastikan gambar boleh dipublikasikan.",
}: {
  label: string;
  current: string | null;
  fileName?: string;
  removeName?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <span className="label">{label}</span>
      {current && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt="" className="h-16 w-24 rounded-lg object-cover ring-1 ring-slate-200" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={removeName} /> Hapus gambar
          </label>
        </div>
      )}
      <input
        name={fileName}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${published ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
      {published ? "Tampil" : "Draf"}
    </span>
  );
}
