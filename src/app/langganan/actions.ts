"use server";

import { headers } from "next/headers";
import { requestSubscription } from "@/lib/newsletter/service";

export type SubscribeState = { status: "idle" | "success" | "error"; message: string };

function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function subscribeAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  try {
    const result = await requestSubscription({
      email: String(formData.get("email") ?? ""),
      consent: formData.get("consent") === "on",
      source: String(formData.get("source") ?? ""),
      honeypot: String(formData.get("website") ?? ""),
      clientIp: clientIp(await headers()),
    });
    return { status: result.ok ? "success" : "error", message: result.message };
  } catch (error) {
    console.error("[newsletter] subscribeAction:", error instanceof Error ? error.message : error);
    return { status: "error", message: "Layanan langganan sedang tidak tersedia. Silakan coba lagi nanti." };
  }
}
