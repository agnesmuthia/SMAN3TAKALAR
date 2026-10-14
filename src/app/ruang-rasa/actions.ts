"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { notifyHandlers } from "@/lib/rasa/notify";
import { lookupReport, reporterReply, submitReport, type ReporterView } from "@/lib/rasa/service";

// Aksi PUBLIK (tanpa login) sesuai rancangan: pelapor boleh anonim. Pelindungnya:
// batas percobaan per IP & per kode (IP hanya disimpan sebagai hash berkunci di
// tabel rate limit), PIN ber-hash, enkripsi isi, dan kolom jebakan bot.

function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export type RasaSubmitState = { status: "idle" | "error" | "success"; message: string; code?: string; pin?: string };

export async function submitRasaReportAction(_prev: RasaSubmitState, formData: FormData): Promise<RasaSubmitState> {
  const result = await submitReport({
    category: String(formData.get("category") ?? ""),
    urgent: formData.get("urgent") === "on",
    body: String(formData.get("body") ?? ""),
    when: String(formData.get("when") ?? ""),
    where: String(formData.get("where") ?? ""),
    contact: String(formData.get("contact") ?? ""),
    honeypot: String(formData.get("website") ?? ""),
    clientIp: clientIp(await headers()),
  });
  if (!result.ok) return { status: "error", message: result.message };
  // Email singkat ke petugas dikirim setelah respons (tanpa isi laporan).
  if (!formData.get("website")) after(() => notifyHandlers("baru"));
  return { status: "success", message: "Laporanmu sudah diterima.", code: result.code, pin: result.pin };
}

export type RasaCheckState = {
  status: "idle" | "error" | "ok";
  message: string;
  view?: ReporterView;
  code?: string;
  pin?: string;
};

// intent=cek: membuka laporan dengan kode + PIN. intent=balas: menambah pesan.
export async function checkRasaAction(prev: RasaCheckState, formData: FormData): Promise<RasaCheckState> {
  const code = String(formData.get("code") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const ip = clientIp(await headers());
  const reply = formData.get("intent") === "balas";
  const result = reply ? await reporterReply(code, pin, String(formData.get("text") ?? ""), ip) : await lookupReport(code, pin, ip);
  // Gagal membalas: tetap tampilkan percakapan sebelumnya agar siswa tidak kehilangan konteks.
  if (!result.ok) return reply ? { status: "error", message: result.message, code, pin, view: prev.view } : { status: "error", message: result.message };
  if (reply) after(() => notifyHandlers("balasan"));
  return { status: "ok", message: reply ? "Pesanmu terkirim." : "", view: result.view, code, pin };
}
