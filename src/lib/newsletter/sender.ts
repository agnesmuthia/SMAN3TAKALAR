import type { EmailProvider, EmailMessage } from "./provider";

// Pengirim kampanye bertahap. Logika ini tidak bergantung pada Supabase
// (memakai antarmuka DeliveryStore) sehingga dapat diuji dengan data fiktif.

export const MAX_DELIVERY_ATTEMPTS = 3;
export const STALE_SENDING_SECONDS = 15 * 60;

export type ClaimedDelivery = {
  deliveryId: string;
  subscriberId: string;
  email: string | null;
  subscriberStatus: "pending" | "active" | "unsubscribed";
  unsubscribeTokenVersion: number;
  suppressed: boolean;
  attempts: number;
};

export type CampaignCounts = {
  total: number;
  sent: number;
  failedFinal: number;
  pending: number;
  skipped: number;
  bounced: number;
  complained: number;
};

export type CampaignOutcome = "sending" | "sent" | "partially_failed" | "failed";

export interface DeliveryStore {
  claim(campaignId: string, limit: number): Promise<ClaimedDelivery[]>;
  markSent(deliveryId: string, providerMessageId: string): Promise<void>;
  markFailed(deliveryId: string, error: string, permanent: boolean): Promise<void>;
  markSkipped(deliveryId: string, reason: string): Promise<void>;
  counts(campaignId: string): Promise<CampaignCounts>;
  finishCampaign(campaignId: string, outcome: Exclude<CampaignOutcome, "sending">, error: string | null): Promise<void>;
}

export function idempotencyKeyFor(campaignId: string, subscriberId: string): string {
  return `newsletter-${campaignId}-${subscriberId}`;
}

// Kampanye hanya dinyatakan selesai bila tidak ada lagi pengiriman yang
// menunggu. "sent" berarti setiap penerima sudah DITERIMA penyedia.
export function computeCampaignOutcome(c: CampaignCounts): CampaignOutcome {
  if (c.pending > 0) return "sending";
  const accepted = c.sent + c.bounced + c.complained;
  if (accepted === 0) return "failed";
  if (c.failedFinal > 0) return "partially_failed";
  return "sent";
}

export type BatchResult = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  outcome: CampaignOutcome;
};

export async function processCampaignBatch(opts: {
  campaignId: string;
  store: DeliveryStore;
  provider: EmailProvider;
  // Membuat isi email untuk satu penerima (termasuk tautan berhenti
  // berlangganan miliknya sendiri).
  buildMessage: (delivery: ClaimedDelivery & { email: string }) => Omit<EmailMessage, "to" | "idempotencyKey">;
  limit?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<BatchResult> {
  const { campaignId, store, provider } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const claimed = await store.claim(campaignId, opts.limit ?? 25);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, delivery] of claimed.entries()) {
    // Diperiksa ulang tepat sebelum kirim: alamat bisa saja berhenti
    // berlangganan atau masuk daftar penolakan setelah kampanye diantrekan.
    if (!delivery.email || delivery.subscriberStatus !== "active" || delivery.suppressed) {
      await store.markSkipped(delivery.deliveryId, "not_active_or_suppressed");
      skipped += 1;
      continue;
    }

    if (index > 0 && opts.delayMs) await sleep(opts.delayMs);

    const content = opts.buildMessage({ ...delivery, email: delivery.email });
    const result = await provider.send({
      ...content,
      to: delivery.email,
      idempotencyKey: idempotencyKeyFor(campaignId, delivery.subscriberId),
    });

    if (result.ok) {
      await store.markSent(delivery.deliveryId, result.messageId);
      sent += 1;
    } else {
      const permanent = !result.retryable || delivery.attempts >= MAX_DELIVERY_ATTEMPTS;
      await store.markFailed(delivery.deliveryId, result.error, permanent);
      failed += 1;
    }
  }

  const outcome = computeCampaignOutcome(await store.counts(campaignId));
  if (outcome !== "sending") {
    await store.finishCampaign(
      campaignId,
      outcome,
      outcome === "sent" ? null : "Sebagian atau seluruh email gagal diterima penyedia.",
    );
  }
  return { claimed: claimed.length, sent, failed, skipped, outcome };
}
