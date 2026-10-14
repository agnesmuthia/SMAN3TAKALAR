import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { newsletterBatchSize, newsletterSendDelayMs, newsletterTokenSecret } from "@/lib/env";
import { NEWSLETTER_CONSENT_TEXT, PRIVACY_POLICY_VERSION, absoluteUrl, siteConfig } from "@/lib/site";
import { emailHash, isValidEmail, normalizeEmail } from "./email";
import { resolveEmailProvider, type ProviderStatus } from "./provider";
import {
  CONFIRMATION_TOKEN_TTL_HOURS,
  generateConfirmationToken,
  hashToken,
  keyedHash,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./tokens";
import { renderConfirmationEmail, renderNewsletterEmail, toNewsletterArticle, type NewsletterArticle } from "./template";
import { isDistributableNews } from "./content-policy";
import {
  MAX_DELIVERY_ATTEMPTS,
  STALE_SENDING_SECONDS,
  processCampaignBatch,
  type BatchResult,
  type CampaignCounts,
  type ClaimedDelivery,
  type DeliveryStore,
} from "./sender";

export const SUBSCRIPTION_SOURCES = ["footer", "halaman_berita", "artikel", "beranda"] as const;
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number];

// Pesan netral yang sama untuk semua kondisi (baru, sudah aktif, sudah
// pernah berhenti, diblokir) agar status langganan tidak bocor.
export const NEUTRAL_SUBSCRIBE_MESSAGE =
  "Terima kasih. Jika alamat tersebut dapat menerima email, kami telah mengirim tautan konfirmasi. Periksa kotak masuk atau folder spam Anda.";

export function getEmailProviderStatus(): ProviderStatus {
  return resolveEmailProvider(process.env);
}

const newsletterSite = () => ({
  name: siteConfig.name,
  url: siteConfig.url,
  logoUrl: siteConfig.logoUrl,
  timeZone: siteConfig.timeZone,
});

export function unsubscribeUrlFor(subscriberId: string, version: number): string {
  const token = signUnsubscribeToken(subscriberId, version, newsletterTokenSecret());
  return absoluteUrl(`/langganan/berhenti?token=${encodeURIComponent(token)}`);
}

export function oneClickUnsubscribeUrlFor(subscriberId: string, version: number): string {
  const token = signUnsubscribeToken(subscriberId, version, newsletterTokenSecret());
  return absoluteUrl(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
}

async function rateLimit(bucket: string, key: string, max: number, windowSeconds: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_key_hash: keyedHash(key, newsletterTokenSecret()),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[newsletter] rate limit gagal diperiksa", error.message);
    return false;
  }
  return data === true;
}

export type SubscribeResult = { ok: boolean; message: string };

export async function requestSubscription(input: {
  email: string;
  consent: boolean;
  source: string;
  honeypot: string;
  clientIp: string | null;
}): Promise<SubscribeResult> {
  // Bot yang mengisi kolom tersembunyi mendapat respons netral tanpa proses.
  if (input.honeypot) return { ok: true, message: NEUTRAL_SUBSCRIBE_MESSAGE };

  const email = normalizeEmail(input.email || "");
  if (!isValidEmail(email)) {
    return { ok: false, message: "Format alamat email tidak valid." };
  }
  if (!input.consent) {
    return { ok: false, message: "Centang persetujuan untuk menerima email berita." };
  }
  const source = (SUBSCRIPTION_SOURCES as readonly string[]).includes(input.source)
    ? (input.source as SubscriptionSource)
    : null;

  const provider = getEmailProviderStatus();
  if (!provider.configured) {
    console.warn("[newsletter] langganan ditolak:", provider.reason);
    return { ok: false, message: "Layanan langganan email belum aktif. Silakan coba lagi nanti." };
  }

  if (!(await rateLimit("subscribe_ip", input.clientIp || "unknown", 10, 60 * 60))) {
    return { ok: false, message: "Terlalu banyak permintaan. Silakan coba lagi nanti." };
  }
  // Batas per alamat: diam-diam (respons tetap netral).
  if (!(await rateLimit("subscribe_email", email, 3, 24 * 60 * 60))) {
    return { ok: true, message: NEUTRAL_SUBSCRIBE_MESSAGE };
  }

  const supabase = createAdminClient();

  const { data: suppression } = await supabase
    .from("newsletter_suppression_records")
    .select("reason")
    .eq("email_hash", emailHash(email))
    .maybeSingle<{ reason: string }>();
  if (suppression && suppression.reason !== "unsubscribed") {
    return { ok: true, message: NEUTRAL_SUBSCRIBE_MESSAGE };
  }

  const { data: existing } = await supabase
    .from("newsletter_subscribers")
    .select("id, status")
    .eq("email", email)
    .maybeSingle<{ id: string; status: "pending" | "active" | "unsubscribed" }>();

  if (existing?.status === "active") {
    return { ok: true, message: NEUTRAL_SUBSCRIBE_MESSAGE };
  }

  const consent = {
    consent_policy_version: PRIVACY_POLICY_VERSION,
    consent_text: NEWSLETTER_CONSENT_TEXT,
    consent_at: new Date().toISOString(),
    requested_at: new Date().toISOString(),
    source,
  };

  let subscriberId: string;
  if (existing) {
    const { error } = await supabase.from("newsletter_subscribers").update(consent).eq("id", existing.id);
    if (error) return failure(error.message);
    subscriberId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email, ...consent })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      // Balapan dua permintaan untuk alamat yang sama: tetap netral.
      if (error?.code === "23505") return { ok: true, message: NEUTRAL_SUBSCRIBE_MESSAGE };
      return failure(error?.message);
    }
    subscriberId = data.id;
  }

  const token = generateConfirmationToken();
  const expiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_HOURS * 3600 * 1000).toISOString();
  const { error: tokenError } = await supabase
    .from("newsletter_confirmation_tokens")
    .insert({ subscriber_id: subscriberId, token_hash: hashToken(token), expires_at: expiresAt });
  if (tokenError) return failure(tokenError.message);

  const message = renderConfirmationEmail({
    site: newsletterSite(),
    confirmUrl: absoluteUrl(`/langganan/konfirmasi?token=${encodeURIComponent(token)}`),
    ttlHours: CONFIRMATION_TOKEN_TTL_HOURS,
  });
  const result = await provider.provider.send({ to: email, ...message });
  if (!result.ok) {
    console.error("[newsletter] email konfirmasi gagal dikirim:", result.error);
    return { ok: false, message: "Email konfirmasi belum dapat dikirim. Silakan coba lagi nanti." };
  }
  return { ok: true, message: NEUTRAL_SUBSCRIBE_MESSAGE };
}

function failure(detail?: string): SubscribeResult {
  console.error("[newsletter] gagal memproses langganan:", detail);
  return { ok: false, message: "Terjadi kesalahan. Silakan coba lagi nanti." };
}

export async function confirmSubscription(token: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("newsletter_confirm", { p_token_hash: hashToken(token) });
  if (error) {
    console.error("[newsletter] konfirmasi gagal:", error.message);
    return false;
  }
  return data === true;
}

export function parseUnsubscribeToken(token: string | null | undefined) {
  return verifyUnsubscribeToken(token, newsletterTokenSecret());
}

export async function unsubscribeWithToken(token: string | null | undefined): Promise<boolean> {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("newsletter_unsubscribe", {
    p_subscriber_id: parsed.subscriberId,
    p_token_version: parsed.version,
  });
  if (error) {
    console.error("[newsletter] berhenti berlangganan gagal:", error.message);
    return false;
  }
  return data === true;
}

// -----------------------------------------------------------------------------
// Kampanye
// -----------------------------------------------------------------------------

type NewsRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  published_at: string | null;
  status: string;
  visibility: string;
  newsletter_eligible: boolean;
};

export type CampaignContent = {
  subject: string;
  heading: string | null;
  intro: string | null;
  template: { heading: string; intro: string; footerNote: string; accentColor: string };
  articles: NewsletterArticle[];
  excludedCount: number;
};

// Memuat isi kampanye dan MEMERIKSA ULANG aturan distribusi setiap berita.
export async function loadCampaignContent(campaignId: string): Promise<CampaignContent | null> {
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("newsletter_campaigns")
    .select("id, subject, heading, intro, template_id")
    .eq("id", campaignId)
    .maybeSingle<{ id: string; subject: string; heading: string | null; intro: string | null; template_id: string | null }>();
  if (!campaign) return null;

  const templateQuery = supabase
    .from("newsletter_templates")
    .select("heading, intro, footer_note, accent_color");
  const { data: template } = await (campaign.template_id
    ? templateQuery.eq("id", campaign.template_id)
    : templateQuery.eq("is_default", true)
  ).maybeSingle<{ heading: string; intro: string; footer_note: string; accent_color: string }>();

  const { data: items } = await supabase
    .from("newsletter_campaign_items")
    .select("position, news:news_id (id, slug, title, excerpt, cover_image_url, published_at, status, visibility, newsletter_eligible)")
    .eq("campaign_id", campaignId)
    .order("position");

  const newsRows = ((items ?? []) as unknown as { news: NewsRow | null }[])
    .map((i) => i.news)
    .filter((n): n is NewsRow => Boolean(n));
  const allowed = newsRows.filter((n) => isDistributableNews(n));

  return {
    subject: campaign.subject,
    heading: campaign.heading,
    intro: campaign.intro,
    template: {
      heading: template?.heading ?? "Kabar Terbaru Sekolah",
      intro: template?.intro ?? "",
      footerNote: template?.footer_note ?? "",
      accentColor: template?.accent_color ?? "#1d4ed8",
    },
    articles: allowed.map((n) => toNewsletterArticle(n, siteConfig.url)),
    excludedCount: newsRows.length - allowed.length,
  };
}

export async function countActiveSubscribers(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return count ?? 0;
}

class SupabaseDeliveryStore implements DeliveryStore {
  private readonly db = createAdminClient();

  async claim(campaignId: string, limit: number): Promise<ClaimedDelivery[]> {
    const { data, error } = await this.db.rpc("newsletter_claim_deliveries", {
      p_campaign_id: campaignId,
      p_limit: limit,
      p_max_attempts: MAX_DELIVERY_ATTEMPTS,
      p_stale_seconds: STALE_SENDING_SECONDS,
    });
    if (error) throw new Error(`Gagal mengklaim antrean: ${error.message}`);
    return ((data ?? []) as {
      delivery_id: string;
      subscriber_id: string;
      email: string | null;
      subscriber_status: ClaimedDelivery["subscriberStatus"];
      unsubscribe_token_version: number;
      suppressed: boolean;
      attempts: number;
    }[]).map((r) => ({
      deliveryId: r.delivery_id,
      subscriberId: r.subscriber_id,
      email: r.email,
      subscriberStatus: r.subscriber_status,
      unsubscribeTokenVersion: r.unsubscribe_token_version,
      suppressed: r.suppressed,
      attempts: r.attempts,
    }));
  }

  async markSent(deliveryId: string, providerMessageId: string) {
    await this.db
      .from("newsletter_deliveries")
      .update({ status: "sent", provider_message_id: providerMessageId, sent_at: new Date().toISOString(), last_error: null })
      .eq("id", deliveryId);
  }

  async markFailed(deliveryId: string, error: string, permanent: boolean) {
    await this.db
      .from("newsletter_deliveries")
      .update({ status: "failed", last_error: error.slice(0, 300), permanent_failure: permanent })
      .eq("id", deliveryId);
  }

  async markSkipped(deliveryId: string, reason: string) {
    await this.db.from("newsletter_deliveries").update({ status: "skipped", last_error: reason }).eq("id", deliveryId);
  }

  async counts(campaignId: string): Promise<CampaignCounts> {
    const { data, error } = await this.db
      .rpc("newsletter_campaign_counts", { p_campaign_id: campaignId, p_max_attempts: MAX_DELIVERY_ATTEMPTS })
      .single<Record<string, number>>();
    if (error || !data) throw new Error(`Gagal menghitung status kampanye: ${error?.message}`);
    return {
      total: Number(data.total),
      sent: Number(data.sent),
      failedFinal: Number(data.failed_final),
      pending: Number(data.pending),
      skipped: Number(data.skipped),
      bounced: Number(data.bounced),
      complained: Number(data.complained),
    };
  }

  async finishCampaign(campaignId: string, outcome: "sent" | "partially_failed" | "failed", error: string | null) {
    await this.db
      .from("newsletter_campaigns")
      .update({ status: outcome, finished_at: new Date().toISOString(), last_error: error })
      .eq("id", campaignId)
      .eq("status", "sending");
  }
}

export type RunResult = { ok: true; batch: BatchResult } | { ok: false; error: string };

// Memproses satu gelombang pengiriman untuk kampanye berstatus 'sending'.
export async function runCampaignBatch(campaignId: string): Promise<RunResult> {
  const provider = getEmailProviderStatus();
  if (!provider.configured) return { ok: false, error: provider.reason };

  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("newsletter_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();
  if (campaign?.status !== "sending") return { ok: false, error: "Kampanye tidak sedang dikirim." };

  const content = await loadCampaignContent(campaignId);
  if (!content || content.articles.length === 0) {
    await supabase
      .from("newsletter_campaigns")
      .update({ status: "failed", finished_at: new Date().toISOString(), last_error: "Tidak ada berita yang memenuhi aturan distribusi." })
      .eq("id", campaignId);
    await supabase
      .from("newsletter_deliveries")
      .update({ status: "skipped", last_error: "campaign_content_invalid" })
      .eq("campaign_id", campaignId)
      .in("status", ["queued", "failed"]);
    return { ok: false, error: "Tidak ada berita yang memenuhi aturan distribusi; pengiriman dihentikan." };
  }

  const batch = await processCampaignBatch({
    campaignId,
    store: new SupabaseDeliveryStore(),
    provider: provider.provider,
    limit: newsletterBatchSize(),
    delayMs: newsletterSendDelayMs(),
    buildMessage: (delivery) => {
      const rendered = renderNewsletterEmail({
        site: newsletterSite(),
        template: content.template,
        subject: content.subject,
        heading: content.heading,
        intro: content.intro,
        articles: content.articles,
        unsubscribeUrl: unsubscribeUrlFor(delivery.subscriberId, delivery.unsubscribeTokenVersion),
      });
      return {
        ...rendered,
        headers: {
          "List-Unsubscribe": `<${oneClickUnsubscribeUrlFor(delivery.subscriberId, delivery.unsubscribeTokenVersion)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    },
  });
  return { ok: true, batch };
}

// Menyetujui lalu memulai pengiriman. Dipanggil setelah assertAdmin().
export async function approveAndStartCampaign(campaignId: string, adminId: string): Promise<RunResult> {
  const provider = getEmailProviderStatus();
  if (!provider.configured) return { ok: false, error: provider.reason };

  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("newsletter_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();
  if (campaign?.status !== "draft") return { ok: false, error: "Hanya kampanye draf yang dapat disetujui." };

  const content = await loadCampaignContent(campaignId);
  if (!content || content.articles.length === 0) {
    return { ok: false, error: "Kampanye belum berisi berita publik yang sudah terbit." };
  }
  if (content.excludedCount > 0) {
    return { ok: false, error: "Ada berita yang tidak lagi memenuhi aturan distribusi. Hapus dari kampanye terlebih dahulu." };
  }
  if ((await countActiveSubscribers()) === 0) {
    return { ok: false, error: "Belum ada pelanggan aktif (terkonfirmasi)." };
  }

  const { data: approved, error } = await supabase
    .from("newsletter_campaigns")
    .update({ status: "approved", approved_by: adminId, approved_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "draft")
    .select("id");
  if (error || !approved?.length) return { ok: false, error: "Kampanye gagal disetujui." };

  const { error: enqueueError } = await supabase.rpc("newsletter_enqueue_campaign", { p_campaign_id: campaignId });
  if (enqueueError) return { ok: false, error: `Gagal menyiapkan antrean: ${enqueueError.message}` };

  await supabase.from("admin_audit_log").insert({
    actor_id: adminId,
    action: "newsletter.campaign_approve_send",
    target_type: "newsletter_campaign",
    target_id: campaignId,
  });
  return runCampaignBatch(campaignId);
}

// Mengantrekan ulang pengiriman gagal yang masih bisa dicoba. Kunci
// idempotensi yang sama dipakai lagi sehingga penerima yang sebenarnya sudah
// menerima tidak mendapat email ganda.
export async function retryFailedDeliveries(campaignId: string, adminId: string): Promise<RunResult> {
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("newsletter_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();
  if (!campaign || !["partially_failed", "failed", "sending"].includes(campaign.status)) {
    return { ok: false, error: "Kampanye ini tidak dapat dicoba ulang." };
  }
  await supabase
    .from("newsletter_deliveries")
    .update({ status: "queued", attempts: 0, last_error: null })
    .eq("campaign_id", campaignId)
    .eq("status", "failed")
    .eq("permanent_failure", false);
  // Pelanggan yang berhenti berlangganan di antara waktu itu akan dilewati
  // saat klaim (status pelanggan diperiksa ulang).
  await supabase
    .from("newsletter_campaigns")
    .update({ status: "sending", finished_at: null, last_error: null })
    .eq("id", campaignId);
  await supabase.from("admin_audit_log").insert({
    actor_id: adminId,
    action: "newsletter.campaign_retry",
    target_type: "newsletter_campaign",
    target_id: campaignId,
  });
  return runCampaignBatch(campaignId);
}

// Mode otomatis saat berita diterbitkan (lihat app_settings.newsletter_auto_mode).
export async function handleNewsPublished(newsId: string, adminId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("newsletter_auto_mode")
    .maybeSingle<{ newsletter_auto_mode: "off" | "draft" | "immediate" }>();
  const mode = settings?.newsletter_auto_mode ?? "off";
  if (mode === "off") return null;

  const { data: news } = await supabase
    .from("news")
    .select("id, title, status, visibility, newsletter_eligible, published_at")
    .eq("id", newsId)
    .maybeSingle<NewsRow>();
  if (!news || !isDistributableNews(news)) return null;

  // Jangan membuat kampanye otomatis ganda untuk berita yang sama.
  const { data: already } = await supabase
    .from("newsletter_campaign_items")
    .select("campaign_id, newsletter_campaigns!inner(mode)")
    .eq("news_id", newsId)
    .eq("newsletter_campaigns.mode", "auto")
    .limit(1);
  if (already?.length) return null;

  const { data: campaign, error } = await supabase
    .from("newsletter_campaigns")
    .insert({ subject: news.title.slice(0, 150), mode: "auto", status: "draft", created_by: adminId })
    .select("id")
    .single<{ id: string }>();
  if (error || !campaign) return "Kampanye otomatis gagal dibuat.";

  const { error: itemError } = await supabase
    .from("newsletter_campaign_items")
    .insert({ campaign_id: campaign.id, news_id: newsId, position: 0 });
  if (itemError) return "Berita tidak memenuhi aturan distribusi buletin.";

  if (mode === "immediate") {
    const result = await approveAndStartCampaign(campaign.id, adminId);
    return result.ok ? null : `Kampanye otomatis dibuat tetapi belum terkirim: ${result.error}`;
  }
  return null;
}

// Dipanggil cron: melanjutkan semua kampanye yang sedang dikirim.
export async function processPendingCampaigns(): Promise<{ campaignId: string; result: RunResult }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("newsletter_campaigns")
    .select("id")
    .eq("status", "sending")
    .order("started_at")
    .limit(5);
  const results: { campaignId: string; result: RunResult }[] = [];
  for (const row of (data ?? []) as { id: string }[]) {
    results.push({ campaignId: row.id, result: await runCampaignBatch(row.id) });
  }
  return results;
}
