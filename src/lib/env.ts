import "server-only";

// Semua rahasia hanya dibaca di server dari environment variables. Jangan
// pernah memberi awalan NEXT_PUBLIC_ pada nilai rahasia.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diisi. Lihat .env.example dan docs/.`);
  }
  return value;
}

export function supabasePublicEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function newsletterTokenSecret(): string {
  const secret = required("NEWSLETTER_TOKEN_SECRET");
  if (secret.length < 32) {
    throw new Error("NEWSLETTER_TOKEN_SECRET minimal 32 karakter.");
  }
  return secret;
}

export function cronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

export function resendWebhookSecret(): string | null {
  return process.env.RESEND_WEBHOOK_SECRET || null;
}

export function newsletterSendDelayMs(): number {
  const value = Number(process.env.NEWSLETTER_SEND_DELAY_MS ?? "600");
  return Number.isFinite(value) && value >= 0 ? value : 600;
}

export function newsletterBatchSize(): number {
  const value = Number(process.env.NEWSLETTER_BATCH_SIZE ?? "25");
  return Number.isInteger(value) && value > 0 && value <= 200 ? value : 25;
}
