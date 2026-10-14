"use server";

import { confirmSubscription, unsubscribeWithToken } from "@/lib/newsletter/service";
import type { ActionFormState } from "@/components/action-form";

// Konfirmasi & berhenti berlangganan dijalankan lewat tombol (POST), bukan
// saat tautan dibuka, agar pemindai tautan email tidak memicunya.

export async function confirmAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  try {
    const ok = await confirmSubscription(String(formData.get("token") ?? ""));
    return ok
      ? { status: "success", message: "Langganan berhasil dikonfirmasi. Anda akan menerima berita terbaru sekolah melalui email." }
      : { status: "error", message: "Tautan konfirmasi tidak valid, sudah dipakai, atau kedaluwarsa. Silakan daftar ulang." };
  } catch {
    return { status: "error", message: "Konfirmasi belum dapat diproses. Silakan coba lagi nanti." };
  }
}

export async function unsubscribeAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  try {
    const ok = await unsubscribeWithToken(String(formData.get("token") ?? ""));
    return ok
      ? { status: "success", message: "Anda telah berhenti berlangganan. Anda tidak akan menerima buletin berikutnya." }
      : { status: "error", message: "Tautan berhenti berlangganan tidak valid." };
  } catch {
    return { status: "error", message: "Permintaan belum dapat diproses. Silakan coba lagi nanti." };
  }
}
