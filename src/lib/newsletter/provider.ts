import { isSingleRecipient } from "./email";

export type EmailMessage = {
  // Selalu SATU penerima. Buletin tidak pernah dikirim dengan banyak alamat
  // di To/CC/BCC.
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  // Kunci idempotensi: penyedia menolak mengirim ulang pesan dengan kunci
  // yang sama sehingga retry tidak menghasilkan email ganda.
  idempotencyKey?: string;
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; retryable: boolean; error: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export type ProviderEnv = {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  NODE_ENV?: string;
};

export class ResendProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly replyTo?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    if (!isSingleRecipient(message.to)) {
      return { ok: false, retryable: false, error: "Alamat penerima tidak valid." };
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey;

    let response: Response;
    try {
      response = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
          ...(this.replyTo ? { reply_to: this.replyTo } : {}),
        }),
      });
    } catch {
      return { ok: false, retryable: true, error: "Tidak dapat menghubungi penyedia email." };
    }

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { id?: string } | null;
      if (data?.id) return { ok: true, messageId: data.id };
      // Jangan anggap berhasil tanpa bukti dari penyedia.
      return { ok: false, retryable: true, error: "Respons penyedia tidak berisi ID pesan." };
    }

    const detail = (await response.json().catch(() => null)) as { name?: string; message?: string } | null;
    const error = `HTTP ${response.status}${detail?.name ? ` ${detail.name}` : ""}`.slice(0, 200);
    // 409: permintaan dengan kunci idempotensi sama masih diproses; 429/5xx: sementara.
    const retryable = response.status === 409 || response.status === 429 || response.status >= 500;
    return { ok: false, retryable, error };
  }
}

// Hanya untuk pengembangan lokal: email dicetak ke log server, tidak dikirim.
export class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  private counter = 0;

  async send(message: EmailMessage): Promise<SendResult> {
    if (!isSingleRecipient(message.to)) {
      return { ok: false, retryable: false, error: "Alamat penerima tidak valid." };
    }
    this.counter += 1;
    console.info(
      `[email:console] ke=${message.to} subjek="${message.subject}"\n${message.text}\n[/email:console]`,
    );
    return { ok: true, messageId: `console-${Date.now()}-${this.counter}` };
  }
}

export type ProviderStatus =
  | { configured: true; provider: EmailProvider }
  | { configured: false; reason: string };

export function resolveEmailProvider(env: ProviderEnv, fetchImpl?: typeof fetch): ProviderStatus {
  const choice = (env.EMAIL_PROVIDER || "").toLowerCase();
  if (choice === "resend") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      return { configured: false, reason: "RESEND_API_KEY dan EMAIL_FROM belum diisi." };
    }
    return {
      configured: true,
      provider: new ResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM, env.EMAIL_REPLY_TO || undefined, fetchImpl),
    };
  }
  if (choice === "console") {
    if (env.NODE_ENV === "production") {
      return { configured: false, reason: "EMAIL_PROVIDER=console tidak boleh dipakai di produksi." };
    }
    return { configured: true, provider: new ConsoleProvider() };
  }
  return { configured: false, reason: "Penyedia email belum dikonfigurasi (EMAIL_PROVIDER)." };
}
