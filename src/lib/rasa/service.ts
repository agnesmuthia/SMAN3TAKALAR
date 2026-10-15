import "server-only";
import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptText,
  dummyVerify,
  encryptText,
  generateCode,
  generatePin,
  hashPin,
  normalizeCode,
  normalizePin,
  parseKey,
  rateKey,
  verifyPin,
} from "./crypto";
import { RASA_CATEGORIES, type RasaCategory, type RasaContent, type RasaSender, type RasaStatus } from "./labels";

// Semua alur PELAPOR (tanpa login) dan pengambilan catatan publik lewat sini.
// Service role dipakai hanya untuk fungsi database khusus Ruang Rasa; pelapor
// tidak pernah mendapat akses tabel. Isi laporan dienkripsi sebelum disimpan.

export function rasaKey(): Buffer | null {
  return parseKey(process.env.RASA_ENCRYPTION_KEY);
}

export function rasaEnabled(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && rasaKey() !== null;
}

const GENERIC_FAIL = "Kode atau PIN tidak cocok. Periksa lagi penulisannya.";
const UNAVAILABLE = "Ruang Rasa sedang tidak dapat dipakai. Silakan coba lagi nanti atau temui Guru BK secara langsung.";
const TOO_MANY = "Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.";

const reportAad = (id: string) => `report:${id}`;
const messageAad = (id: string) => `msg:${id}`;

async function allowed(bucket: string, value: string, max: number, windowSeconds: number, key: Buffer): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_bucket: bucket,
    p_key_hash: rateKey(value, key),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[ruang-rasa] rate limit gagal diperiksa:", error.code);
    return false; // gagal tertutup
  }
  return data === true;
}

export type SubmitInput = {
  category: string;
  urgent: boolean;
  body: string;
  when: string;
  where: string;
  contact: string;
  honeypot: string;
  clientIp: string | null;
};
export type SubmitResult = { ok: true; code: string; pin: string } | { ok: false; message: string };

export function validateSubmission(input: Omit<SubmitInput, "honeypot" | "clientIp">): string | null {
  if (!(RASA_CATEGORIES as string[]).includes(input.category)) return "Pilih jenis kejadian.";
  const body = input.body.trim();
  if (body.length < 10) return "Ceritakan sedikit lebih lengkap (minimal 10 karakter).";
  if (body.length > 5000) return "Cerita terlalu panjang (maksimal 5000 karakter). Kamu bisa menambahkannya lewat balasan nanti.";
  if (input.when.length > 200 || input.where.length > 200 || input.contact.length > 200) return "Salah satu isian terlalu panjang (maksimal 200 karakter).";
  return null;
}

export async function submitReport(input: SubmitInput): Promise<SubmitResult> {
  // Bot yang mengisi kolom jebakan mendapat respons berhasil palsu tanpa proses.
  if (input.honeypot) return { ok: true, code: generateCode(), pin: generatePin() };
  const key = rasaKey();
  if (!rasaEnabled() || !key) return { ok: false, message: UNAVAILABLE };
  const invalid = validateSubmission(input);
  if (invalid) return { ok: false, message: invalid };

  try {
    if (!(await allowed("rasa_submit_ip", input.clientIp || "tidak-diketahui", 5, 60 * 60, key))) return { ok: false, message: TOO_MANY };
    if (!(await allowed("rasa_submit_all", "semua", 100, 60 * 60, key))) return { ok: false, message: TOO_MANY };

    const id = randomUUID();
    const content: RasaContent = { v: 1, body: input.body.trim(), when: input.when.trim(), where: input.where.trim(), contact: input.contact.trim() };
    const sealed = encryptText(JSON.stringify(content), reportAad(id), key);
    const admin = createAdminClient();
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode();
      const pin = generatePin();
      const { salt, hash } = hashPin(pin);
      const { error } = await admin.rpc("rasa_submit", {
        p_id: id, p_category: input.category, p_urgent: input.urgent, p_content: sealed, p_code: code, p_salt: salt, p_hash: hash,
      });
      if (!error) return { ok: true, code, pin };
      if (error.code !== "23505") {
        console.error("[ruang-rasa] simpan laporan gagal:", error.code);
        return { ok: false, message: UNAVAILABLE };
      }
    }
    return { ok: false, message: UNAVAILABLE };
  } catch (error) {
    console.error("[ruang-rasa] kesalahan tak terduga saat mengirim:", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: UNAVAILABLE };
  }
}

export type ReporterMessage = { id: string; sender: RasaSender; text: string; createdAt: string };
export type ReporterView = {
  category: RasaCategory;
  status: RasaStatus;
  urgent: boolean;
  createdAt: string;
  messages: ReporterMessage[];
};
export type LookupResult = { ok: true; view: ReporterView; reportId: string } | { ok: false; message: string };

// Memverifikasi kode + PIN dengan pembatasan percobaan.
async function authenticate(codeInput: string, pinInput: string, clientIp: string | null, key: Buffer): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!(await allowed("rasa_lookup_ip", clientIp || "tidak-diketahui", 30, 15 * 60, key))) return { ok: false, message: TOO_MANY };
  const code = normalizeCode(codeInput);
  const pin = normalizePin(pinInput);
  if (!code || !pin) {
    dummyVerify("AAAA-AAAA");
    return { ok: false, message: GENERIC_FAIL };
  }
  if (!(await allowed("rasa_lookup_code", code, 8, 15 * 60, key))) return { ok: false, message: TOO_MANY };
  const { data, error } = await createAdminClient().rpc("rasa_reporter_credentials", { p_code: code });
  if (error) {
    console.error("[ruang-rasa] ambil kredensial gagal:", error.code);
    return { ok: false, message: UNAVAILABLE };
  }
  const row = (data as { id: string; pin_salt: string; pin_hash: string }[] | null)?.[0];
  if (!row) {
    dummyVerify(pin);
    return { ok: false, message: GENERIC_FAIL };
  }
  return verifyPin(pin, row.pin_salt, row.pin_hash) ? { ok: true, id: row.id } : { ok: false, message: GENERIC_FAIL };
}

type RawView = {
  status: RasaStatus; category: RasaCategory; urgent: boolean; created_at: string;
  messages: { id: string; sender: RasaSender; content: string; created_at: string }[];
};

async function loadView(id: string, key: Buffer): Promise<ReporterView | null> {
  const { data, error } = await createAdminClient().rpc("rasa_reporter_view", { p_id: id });
  if (error || !data) return null;
  const raw = data as RawView;
  return {
    category: raw.category, status: raw.status, urgent: raw.urgent, createdAt: raw.created_at,
    messages: raw.messages.map((m) => ({ id: m.id, sender: m.sender, createdAt: m.created_at, text: decryptText(m.content, messageAad(id), key) })),
  };
}

export async function lookupReport(code: string, pin: string, clientIp: string | null): Promise<LookupResult> {
  const key = rasaKey();
  if (!rasaEnabled() || !key) return { ok: false, message: UNAVAILABLE };
  try {
    const auth = await authenticate(code, pin, clientIp, key);
    if (!auth.ok) return auth;
    const view = await loadView(auth.id, key);
    return view ? { ok: true, view, reportId: auth.id } : { ok: false, message: UNAVAILABLE };
  } catch (error) {
    console.error("[ruang-rasa] kesalahan tak terduga saat mencari:", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: UNAVAILABLE };
  }
}

export async function reporterReply(code: string, pin: string, text: string, clientIp: string | null): Promise<LookupResult> {
  const key = rasaKey();
  if (!rasaEnabled() || !key) return { ok: false, message: UNAVAILABLE };
  const body = text.trim();
  if (body.length < 2) return { ok: false, message: "Tulis pesanmu terlebih dahulu." };
  if (body.length > 3000) return { ok: false, message: "Pesan terlalu panjang (maksimal 3000 karakter)." };
  try {
    const auth = await authenticate(code, pin, clientIp, key);
    if (!auth.ok) return auth;
    if (!(await allowed("rasa_reply", auth.id, 10, 60 * 60, key))) return { ok: false, message: TOO_MANY };
    const { error } = await createAdminClient().rpc("rasa_reporter_reply", { p_id: auth.id, p_content: encryptText(body, messageAad(auth.id), key) });
    if (error) {
      if (error.code === "22023") return { ok: false, message: "Laporan ini sudah selesai atau pesannya sudah terlalu banyak. Kamu dapat membuat laporan baru." };
      console.error("[ruang-rasa] simpan balasan gagal:", error.code);
      return { ok: false, message: UNAVAILABLE };
    }
    const view = await loadView(auth.id, key);
    return view ? { ok: true, view, reportId: auth.id } : { ok: false, message: UNAVAILABLE };
  } catch (error) {
    console.error("[ruang-rasa] kesalahan tak terduga saat membalas:", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: UNAVAILABLE };
  }
}

// -----------------------------------------------------------------------------
// Sisi petugas: dekripsi (setelah fungsi database memeriksa & mencatat akses)
// -----------------------------------------------------------------------------
export type StaffReport = {
  id: string; referenceCode: string; category: RasaCategory; urgent: boolean; status: RasaStatus;
  createdAt: string; closedAt: string | null; content: RasaContent | null;
  messages: { id: string; sender: RasaSender; text: string; createdAt: string }[];
};

export function decryptStaffReport(raw: {
  id: string; reference_code: string; category: RasaCategory; urgent: boolean; status: RasaStatus;
  created_at: string; closed_at: string | null; content: string;
  messages: { id: string; sender: RasaSender; content: string; created_at: string }[];
}): StaffReport {
  const key = rasaKey();
  if (!key) throw new Error("kunci_tidak_ada");
  let content: RasaContent | null = null;
  try {
    content = JSON.parse(decryptText(raw.content, reportAad(raw.id), key)) as RasaContent;
  } catch {
    content = null; // kunci salah / data rusak: ditampilkan sebagai tidak terbaca
  }
  return {
    id: raw.id, referenceCode: raw.reference_code, category: raw.category, urgent: raw.urgent, status: raw.status,
    createdAt: raw.created_at, closedAt: raw.closed_at, content,
    messages: raw.messages.map((m) => {
      let text = "(pesan tidak dapat dibaca)";
      try { text = decryptText(m.content, messageAad(raw.id), key); } catch { /* biarkan */ }
      return { id: m.id, sender: m.sender, createdAt: m.created_at, text };
    }),
  };
}

export function encryptStaffReply(reportId: string, text: string): string | null {
  const key = rasaKey();
  return key ? encryptText(text, messageAad(reportId), key) : null;
}

// Catatan prosedur darurat yang ditulis sekolah (Super Admin) untuk formulir publik.
export async function getRasaNotice(): Promise<string | null> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data } = await createAdminClient().from("app_settings").select("rasa_notice").maybeSingle<{ rasa_notice: string | null }>();
    return data?.rasa_notice?.trim() || null;
  } catch {
    return null;
  }
}

export async function purgeExpiredReports(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("rasa_purge_expired");
  if (error) {
    console.error("[ruang-rasa] pembersihan gagal:", error.code);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
