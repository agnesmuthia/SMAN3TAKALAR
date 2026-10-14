import { describe, expect, it, vi } from "vitest";
import {
  computeCampaignOutcome,
  idempotencyKeyFor,
  MAX_DELIVERY_ATTEMPTS,
  processCampaignBatch,
  type CampaignCounts,
  type ClaimedDelivery,
  type DeliveryStore,
} from "@/lib/newsletter/sender";
import { ResendProvider, resolveEmailProvider, type EmailMessage, type EmailProvider, type SendResult } from "@/lib/newsletter/provider";
import { renderConfirmationEmail, renderNewsletterEmail, toNewsletterArticle } from "@/lib/newsletter/template";

// ---------------------------------------------------------------------------
// Penyimpanan & penyedia palsu (data fiktif)
// ---------------------------------------------------------------------------

type Row = ClaimedDelivery & { status: string; permanent: boolean; messageId?: string };

class MemoryStore implements DeliveryStore {
  rows: Row[];
  finished: { outcome: string; error: string | null } | null = null;

  constructor(rows: Omit<Row, "status" | "permanent" | "attempts">[]) {
    this.rows = rows.map((r) => ({ ...r, status: "queued", permanent: false, attempts: 0 }));
  }

  async claim(_campaignId: string, limit: number) {
    const picked = this.rows
      .filter((r) => r.status === "queued" || (r.status === "failed" && !r.permanent && r.attempts < MAX_DELIVERY_ATTEMPTS))
      .slice(0, limit);
    for (const r of picked) {
      r.status = "sending";
      r.attempts += 1;
    }
    return picked.map((r) => ({ ...r }));
  }
  async markSent(id: string, messageId: string) {
    Object.assign(this.find(id), { status: "sent", messageId });
  }
  async markFailed(id: string, _error: string, permanent: boolean) {
    Object.assign(this.find(id), { status: "failed", permanent });
  }
  async markSkipped(id: string) {
    this.find(id).status = "skipped";
  }
  async counts(): Promise<CampaignCounts> {
    const by = (pred: (r: Row) => boolean) => this.rows.filter(pred).length;
    return {
      total: this.rows.length,
      sent: by((r) => r.status === "sent"),
      failedFinal: by((r) => r.status === "failed" && (r.permanent || r.attempts >= MAX_DELIVERY_ATTEMPTS)),
      pending: by((r) => ["queued", "sending"].includes(r.status) || (r.status === "failed" && !r.permanent && r.attempts < MAX_DELIVERY_ATTEMPTS)),
      skipped: by((r) => r.status === "skipped"),
      bounced: 0,
      complained: 0,
    };
  }
  async finishCampaign(_id: string, outcome: string, error: string | null) {
    this.finished = { outcome, error };
  }
  private find(id: string) {
    const row = this.rows.find((r) => r.deliveryId === id);
    if (!row) throw new Error("not found");
    return row;
  }
}

class FakeProvider implements EmailProvider {
  readonly name = "fake";
  sent: EmailMessage[] = [];
  // Mensimulasikan idempotensi penyedia: kunci yang sama tidak dikirim dua kali.
  delivered = new Map<string, string>();
  constructor(private readonly behaviour: (msg: EmailMessage, call: number) => SendResult | null = () => null) {}
  private calls = 0;

  async send(msg: EmailMessage): Promise<SendResult> {
    this.calls += 1;
    const override = this.behaviour(msg, this.calls);
    if (override && !override.ok) return override;
    if (msg.idempotencyKey && this.delivered.has(msg.idempotencyKey)) {
      return { ok: true, messageId: this.delivered.get(msg.idempotencyKey)! };
    }
    this.sent.push(msg);
    const id = `msg-${this.sent.length}`;
    if (msg.idempotencyKey) this.delivered.set(msg.idempotencyKey, id);
    return { ok: true, messageId: id };
  }
}

const recipients = [
  { deliveryId: "d1", subscriberId: "s1", email: "satu@contoh.test", subscriberStatus: "active" as const, unsubscribeTokenVersion: 1, suppressed: false },
  { deliveryId: "d2", subscriberId: "s2", email: "dua@contoh.test", subscriberStatus: "active" as const, unsubscribeTokenVersion: 1, suppressed: false },
  { deliveryId: "d3", subscriberId: "s3", email: "tiga@contoh.test", subscriberStatus: "unsubscribed" as const, unsubscribeTokenVersion: 1, suppressed: true },
  { deliveryId: "d4", subscriberId: "s4", email: "empat@contoh.test", subscriberStatus: "pending" as const, unsubscribeTokenVersion: 1, suppressed: false },
];

const buildMessage = (d: ClaimedDelivery & { email: string }) => ({
  subject: "Buletin Fiktif",
  html: `<p>Halo</p><a href="https://sekolah.test/langganan/berhenti?token=${d.subscriberId}">Berhenti</a>`,
  text: `Berhenti: https://sekolah.test/langganan/berhenti?token=${d.subscriberId}`,
});

describe("processCampaignBatch", () => {
  it("mengirim satu email per penerima aktif, tanpa alamat penerima lain", async () => {
    const store = new MemoryStore(recipients);
    const provider = new FakeProvider();
    const result = await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage, limit: 10 });

    expect(result.sent).toBe(2);
    expect(provider.sent.map((m) => m.to)).toEqual(["satu@contoh.test", "dua@contoh.test"]);
    for (const msg of provider.sent) {
      const others = recipients.map((r) => r.email).filter((e) => e !== msg.to);
      for (const other of others) {
        expect(msg.html).not.toContain(other);
        expect(msg.text).not.toContain(other);
        expect(msg.to).not.toContain(other);
      }
    }
  });

  it("melewati alamat yang berhenti berlangganan, ditolak, atau belum konfirmasi", async () => {
    const store = new MemoryStore(recipients);
    const provider = new FakeProvider();
    const result = await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage, limit: 10 });
    expect(result.skipped).toBe(2);
    expect(provider.sent.some((m) => m.to === "tiga@contoh.test" || m.to === "empat@contoh.test")).toBe(false);
    expect(store.finished?.outcome).toBe("sent");
  });

  it("memakai kunci idempotensi stabil per kampanye+pelanggan", async () => {
    const store = new MemoryStore(recipients.slice(0, 1));
    const provider = new FakeProvider();
    await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage });
    expect(provider.sent[0].idempotencyKey).toBe(idempotencyKeyFor("c1", "s1"));
  });

  it("retry setelah kegagalan sementara tidak menghasilkan email ganda", async () => {
    // Panggilan pertama ke penerima kedua gagal sementara (mis. 429).
    const provider = new FakeProvider((msg, call) =>
      call === 2 ? { ok: false, retryable: true, error: "HTTP 429" } : null,
    );
    const store = new MemoryStore(recipients.slice(0, 2));
    const first = await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage });
    expect(first.failed).toBe(1);
    expect(first.outcome).toBe("sending");
    expect(store.finished).toBeNull();

    const second = await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage });
    expect(second.sent).toBe(1);
    expect(second.outcome).toBe("sent");
    // Setiap alamat tepat menerima satu email.
    expect(provider.sent.map((m) => m.to).sort()).toEqual(["dua@contoh.test", "satu@contoh.test"]);
  });

  it("pengiriman ulang baris yang sama memakai kunci sama sehingga penyedia tidak mengirim dua kali", async () => {
    const provider = new FakeProvider();
    const storeA = new MemoryStore(recipients.slice(0, 1));
    await processCampaignBatch({ campaignId: "c1", store: storeA, provider, buildMessage });
    // Simulasi proses macet: baris yang sama diproses lagi.
    const storeB = new MemoryStore(recipients.slice(0, 1));
    await processCampaignBatch({ campaignId: "c1", store: storeB, provider, buildMessage });
    expect(provider.sent).toHaveLength(1);
  });

  it("tidak menandai kampanye berhasil bila penyedia menolak semua email", async () => {
    const provider = new FakeProvider(() => ({ ok: false, retryable: false, error: "HTTP 403" }));
    const store = new MemoryStore(recipients.slice(0, 2));
    const result = await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage });
    expect(result.outcome).toBe("failed");
    expect(store.finished?.outcome).toBe("failed");
  });

  it("kegagalan sebagian menghasilkan status partially_failed", async () => {
    const provider = new FakeProvider((msg) => (msg.to === "dua@contoh.test" ? { ok: false, retryable: false, error: "HTTP 422" } : null));
    const store = new MemoryStore(recipients.slice(0, 2));
    const result = await processCampaignBatch({ campaignId: "c1", store, provider, buildMessage });
    expect(result.outcome).toBe("partially_failed");
  });

  it("menjeda antar email sesuai delayMs", async () => {
    const sleep = vi.fn(async () => {});
    const store = new MemoryStore(recipients.slice(0, 2));
    await processCampaignBatch({ campaignId: "c1", store, provider: new FakeProvider(), buildMessage, delayMs: 500, sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
  });
});

describe("computeCampaignOutcome", () => {
  const zero: CampaignCounts = { total: 0, sent: 0, failedFinal: 0, pending: 0, skipped: 0, bounced: 0, complained: 0 };
  it("masih mengirim selama ada antrean", () => {
    expect(computeCampaignOutcome({ ...zero, total: 2, sent: 1, pending: 1 })).toBe("sending");
  });
  it("tanpa penerima yang diterima penyedia = gagal", () => {
    expect(computeCampaignOutcome({ ...zero, total: 2, skipped: 2 })).toBe("failed");
  });
});

describe("ResendProvider", () => {
  const ok = () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 });

  it("mengirim satu penerima, header idempotensi, tanpa CC/BCC", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ok());
    const provider = new ResendProvider("re_test_placeholder", "Sekolah <berita@contoh.test>", undefined, fetchMock as unknown as typeof fetch);
    const result = await provider.send({ to: "a@contoh.test", subject: "S", html: "<p>x</p>", text: "x", idempotencyKey: "k1" });
    expect(result).toEqual({ ok: true, messageId: "re_123" });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.to).toEqual(["a@contoh.test"]);
    expect(body.cc).toBeUndefined();
    expect(body.bcc).toBeUndefined();
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
  });

  it("menolak daftar penerima ganda sebelum memanggil API", async () => {
    const fetchMock = vi.fn(async () => ok());
    const provider = new ResendProvider("k", "f@contoh.test", undefined, fetchMock as unknown as typeof fetch);
    const result = await provider.send({ to: "a@contoh.test,b@contoh.test", subject: "S", html: "", text: "" });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("membedakan error sementara dan permanen", async () => {
    const make = (status: number) =>
      new ResendProvider("k", "f@contoh.test", undefined, (async () => new Response("{}", { status })) as unknown as typeof fetch);
    expect(await make(429).send({ to: "a@contoh.test", subject: "S", html: "", text: "" })).toMatchObject({ ok: false, retryable: true });
    expect(await make(500).send({ to: "a@contoh.test", subject: "S", html: "", text: "" })).toMatchObject({ ok: false, retryable: true });
    expect(await make(422).send({ to: "a@contoh.test", subject: "S", html: "", text: "" })).toMatchObject({ ok: false, retryable: false });
  });

  it("tidak menganggap berhasil tanpa ID pesan dari penyedia", async () => {
    const provider = new ResendProvider("k", "f@contoh.test", undefined, (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);
    expect((await provider.send({ to: "a@contoh.test", subject: "S", html: "", text: "" })).ok).toBe(false);
  });
});

describe("resolveEmailProvider", () => {
  it("tidak aktif tanpa konfigurasi", () => {
    expect(resolveEmailProvider({}).configured).toBe(false);
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend" }).configured).toBe(false);
  });
  it("mode console dilarang di produksi", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "console", NODE_ENV: "production" }).configured).toBe(false);
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "console", NODE_ENV: "development" }).configured).toBe(true);
  });
});

describe("template email", () => {
  const site = { name: "SMA Negeri Contoh", url: "https://sekolah.test", logoUrl: null, timeZone: "Asia/Makassar" };
  const template = { heading: "Kabar Sekolah", intro: "Pengantar", footerNote: "Catatan", accentColor: "#1d4ed8" };

  it("hanya memuat kolom publik berita (tanpa isi lengkap / data lain)", () => {
    const newsRow = {
      slug: "berita-fiktif",
      title: "Judul <b>Fiktif</b>",
      excerpt: "Ringkasan fiktif",
      cover_image_url: "http://tidak-aman.test/a.jpg",
      published_at: "2026-10-13T02:00:00Z",
      // Kolom-kolom berikut TIDAK boleh ikut ke email.
      content: "ISI LENGKAP RAHASIA",
      ruang_rasa_report: "CATATAN KONSELING FIKTIF",
      student_nis: "0012345678",
    };
    const article = toNewsletterArticle(newsRow, site.url);
    expect(Object.keys(article).sort()).toEqual(["excerpt", "imageUrl", "publishedAt", "title", "url"]);
    expect(article.imageUrl).toBeNull(); // hanya https

    const email = renderNewsletterEmail({ site, template, subject: "Buletin", articles: [article], unsubscribeUrl: "https://sekolah.test/langganan/berhenti?token=abc" });
    for (const forbidden of ["ISI LENGKAP RAHASIA", "CATATAN KONSELING FIKTIF", "0012345678"]) {
      expect(email.html).not.toContain(forbidden);
      expect(email.text).not.toContain(forbidden);
    }
    expect(email.html).toContain("Judul &lt;b&gt;Fiktif&lt;/b&gt;");
    expect(email.html).toContain("Baca berita selengkapnya");
    expect(email.html).toContain("https://sekolah.test/berita/berita-fiktif");
  });

  it("selalu memuat tautan berhenti berlangganan dan tautan website", () => {
    const email = renderNewsletterEmail({
      site,
      template,
      subject: "Buletin",
      articles: [],
      unsubscribeUrl: "https://sekolah.test/langganan/berhenti?token=abc",
    });
    expect(email.html).toContain("https://sekolah.test/langganan/berhenti?token=abc");
    expect(email.html).toContain("Berhenti berlangganan");
    expect(email.text).toContain("Berhenti berlangganan: https://sekolah.test/langganan/berhenti?token=abc");
    expect(email.html).toContain('href="https://sekolah.test/"');
  });

  it("menetralkan URL berbahaya", () => {
    const email = renderNewsletterEmail({
      site,
      template: { ...template, accentColor: "red;background:url(x)" },
      subject: "S",
      articles: [{ title: "T", excerpt: "", url: "javascript:alert(1)", imageUrl: null, publishedAt: "2026-10-13T00:00:00Z" }],
      unsubscribeUrl: "https://sekolah.test/u",
    });
    expect(email.html).not.toContain("javascript:");
    expect(email.html).not.toContain("url(x)");
  });

  it("email konfirmasi berisi tautan & masa berlaku", () => {
    const email = renderConfirmationEmail({ site, confirmUrl: "https://sekolah.test/langganan/konfirmasi?token=t", ttlHours: 48 });
    expect(email.html).toContain("https://sekolah.test/langganan/konfirmasi?token=t");
    expect(email.text).toContain("48 jam");
  });
});
