import Link from "next/link";

export function LanggananNav() {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <Link href="/admin/langganan" className="btn-secondary">Pelanggan</Link>
      <Link href="/admin/langganan/kampanye" className="btn-secondary">Kampanye</Link>
      <Link href="/admin/langganan/template" className="btn-secondary">Template email</Link>
    </div>
  );
}
