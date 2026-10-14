import { createHash } from "node:crypto";
import { z } from "zod";

const emailSchema = z.email().max(254);

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  return emailSchema.safeParse(normalizeEmail(input)).success;
}

// Harus sama dengan public.newsletter_email_hash() di database.
export function emailHash(email: string): string {
  return createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}

// Satu alamat penerima per email; mencegah daftar penerima tergabung.
export function isSingleRecipient(to: string): boolean {
  return isValidEmail(to) && !/[,;<>\s]/.test(to.trim());
}
