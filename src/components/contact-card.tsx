import type { SiteProfile } from "@/lib/content/site-profile";

// Kontak resmi dari Profil Sekolah. Bagian yang kosong tidak ditampilkan.
export function ContactCard({ profile }: { profile: SiteProfile }) {
  const { address, phone, email, whatsapp, maps_url } = profile;
  if (!address && !phone && !email && !whatsapp && !maps_url) return null;
  return (
    <section className="card" aria-labelledby="judul-kontak">
      <h2 id="judul-kontak" className="font-semibold text-navy-900">Kontak sekolah</h2>
      <address className="mt-3 space-y-2 text-sm not-italic text-slate-700">
        {address && <p>{address}</p>}
        {phone && <p>Telepon: <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-teal-700 hover:underline">{phone}</a></p>}
        {whatsapp && (
          <p>WhatsApp: <a href={`https://wa.me/${whatsapp.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">{whatsapp}</a></p>
        )}
        {email && <p>Email: <a href={`mailto:${email}`} className="text-teal-700 hover:underline">{email}</a></p>}
        {maps_url && (
          <p><a href={maps_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 hover:underline">Lihat lokasi di peta ↗</a></p>
        )}
      </address>
    </section>
  );
}
