import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireRole } from "@/lib/auth/dal";
import { formatTanggal, siteConfig } from "@/lib/site";
import { MAX_DELIVERY_ATTEMPTS } from "@/lib/newsletter/sender";
import { renderNewsletterEmail } from "@/lib/newsletter/template";
import { countActiveSubscribers, getEmailProviderStatus, loadCampaignContent } from "@/lib/newsletter/service";
import {
  approveCampaignAction,
  cancelCampaignAction,
  continueCampaignAction,
  removeCampaignItemAction,
  retryCampaignAction,
} from "../../../actions";
import { LanggananNav } from "../../subnav";
import { CAMPAIGN_STATUS_LABEL, DELIVERY_STATUS_LABEL } from "../labels";

export const metadata: Metadata = { title: "Detail kampanye" };

type Campaign = {
  id: string;
  subject: string;
  status: string;
  mode: string;
  created_at: string;
  approved_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
};

export default async function KampanyeDetailPage({ params }: PageProps<"/admin/langganan/kampanye/[id]">) {
  const { id } = await params;
  const ctx = await requireRole(["admin"], `/admin/langganan/kampanye/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = ctx.supabase;

  const { data: campaign } = await db
    .from("newsletter_campaigns")
    .select("id, subject, status, mode, created_at, approved_at, started_at, finished_at, last_error")
    .eq("id", id)
    .maybeSingle<Campaign>();
  if (!campaign) notFound();

  const [{ data: items }, { data: counts }, content, activeCount] = await Promise.all([
    db.from("newsletter_campaign_items").select("news_id, position, news:news_id (title)").eq("campaign_id", id).order("position"),
    db.rpc("newsletter_campaign_counts", { p_campaign_id: id, p_max_attempts: MAX_DELIVERY_ATTEMPTS }).maybeSingle<Record<string, number>>(),
    loadCampaignContent(id),
    countActiveSubscribers(),
  ]);
  const { data: deliveryRows } = await db
    .from("newsletter_deliveries")
    .select("status")
    .eq("campaign_id", id);
  const byStatus = new Map<string, number>();
  for (const d of (deliveryRows ?? []) as { status: string }[]) byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);

  const itemRows = (items ?? []) as unknown as { news_id: string; news: { title: string } | null }[];
  const provider = getEmailProviderStatus();

  // Pratinjau memakai tautan berhenti berlangganan contoh (tidak berlaku).
  const preview = content
    ? renderNewsletterEmail({
        site: { name: siteConfig.name, url: siteConfig.url, logoUrl: siteConfig.logoUrl, timeZone: siteConfig.timeZone },
        template: content.template,
        subject: content.subject,
        heading: content.heading,
        intro: content.intro,
        articles: content.articles,
        unsubscribeUrl: `${siteConfig.url}/langganan/berhenti?token=contoh-pratinjau`,
      })
    : null;

  const total = Number(counts?.total ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-900">{campaign.subject}</h1>
        <LanggananNav />
      </div>

      <dl className="card grid gap-4 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-500">Status</dt><dd className="font-semibold">{CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status}</dd></div>
        <div><dt className="text-slate-500">Mode</dt><dd>{campaign.mode === "auto" ? "Otomatis (berita terbit)" : "Manual"}</dd></div>
        <div><dt className="text-slate-500">Dibuat</dt><dd>{formatTanggal(campaign.created_at)}</dd></div>
        <div><dt className="text-slate-500">Selesai</dt><dd>{campaign.finished_at ? formatTanggal(campaign.finished_at) : "—"}</dd></div>
      </dl>

      {campaign.last_error && <Alert tone="error">{campaign.last_error}</Alert>}
      {!provider.configured && <Alert tone="warning">Penyedia email belum aktif: {provider.reason}</Alert>}
      {content && content.excludedCount > 0 && (
        <Alert tone="warning">
          {content.excludedCount} berita tidak lagi memenuhi aturan distribusi (draf/internal/belum terbit) dan
          tidak akan dikirim.
        </Alert>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Isi buletin</h2>
        <ul className="space-y-2 text-sm">
          {itemRows.map((item) => (
            <li key={item.news_id} className="flex items-center justify-between gap-3">
              <span>{item.news?.title ?? "(berita tidak ditemukan)"}</span>
              {campaign.status === "draft" && (
                <ActionForm action={removeCampaignItemAction} submitLabel="Hapus" className="" submitClassName="text-xs font-semibold text-red-700 hover:underline">
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <input type="hidden" name="newsId" value={item.news_id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>

      {total > 0 && (
        <section className="card space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Status pengiriman</h2>
          <p>
            Total penerima: <strong>{total}</strong>. &quot;Diterima penyedia&quot; berarti penyedia email menerima pesan;
            status bounce/spam diperbarui lewat webhook.
          </p>
          <ul className="grid gap-2 sm:grid-cols-4">
            {Object.entries(DELIVERY_STATUS_LABEL).map(([key, label]) => (
              <li key={key} className="rounded border border-slate-200 p-2">
                <span className="text-slate-500">{label}</span>
                <p className="text-xl font-bold">{byStatus.get(key) ?? 0}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Tindakan</h2>
        {campaign.status === "draft" && (
          <ActionForm action={approveCampaignAction} submitLabel="Setujui & kirim" submitClassName="btn-primary">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <p className="text-sm text-slate-600">
              Akan dikirim ke <strong>{activeCount}</strong> pelanggan aktif yang sudah konfirmasi. Setiap penerima
              mendapat email terpisah; alamat penerima lain tidak terlihat.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" required className="mt-1" />
              <span>Saya telah meninjau pratinjau dan menyetujui buletin ini untuk dikirim.</span>
            </label>
          </ActionForm>
        )}
        {campaign.status === "sending" && (
          <ActionForm action={continueCampaignAction} submitLabel="Lanjutkan pengiriman" submitClassName="btn-primary">
            <input type="hidden" name="campaignId" value={campaign.id} />
          </ActionForm>
        )}
        {["partially_failed", "failed"].includes(campaign.status) && (
          <ActionForm action={retryCampaignAction} submitLabel="Coba kirim ulang yang gagal" submitClassName="btn-primary">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <p className="text-sm text-slate-600">
              Hanya pengiriman yang gagal sementara yang dicoba ulang. Kunci idempotensi yang sama mencegah email ganda.
            </p>
          </ActionForm>
        )}
        {["draft", "approved", "sending"].includes(campaign.status) && (
          <ActionForm action={cancelCampaignAction} submitLabel="Batalkan kampanye" submitClassName="btn-secondary">
            <input type="hidden" name="campaignId" value={campaign.id} />
          </ActionForm>
        )}
      </section>

      {preview && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Pratinjau email</h2>
          <iframe
            title="Pratinjau email buletin"
            srcDoc={preview.html}
            sandbox=""
            className="h-[640px] w-full rounded-lg border border-slate-200 bg-white"
          />
        </section>
      )}
    </div>
  );
}
