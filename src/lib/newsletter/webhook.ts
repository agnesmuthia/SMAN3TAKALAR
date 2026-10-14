import { createHmac, timingSafeEqual } from "node:crypto";

// Verifikasi tanda tangan webhook gaya Svix (dipakai Resend):
//   isi bertanda tangan = `${svix-id}.${svix-timestamp}.${body}`
//   svix-signature      = "v1,<base64>" (bisa lebih dari satu, dipisah spasi)
//   secret              = "whsec_<base64>"
export function verifyWebhookSignature(input: {
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const { id, timestamp, signatureHeader, body, secret } = input;
  if (!id || !timestamp || !signatureHeader || !secret) return false;
  if (!/^[0-9]{1,12}$/.test(timestamp)) return false;

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(now - Number(timestamp)) > tolerance) return false;

  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(rawSecret, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64"));
  return signatureHeader.split(" ").some((part) => {
    const [version, signature] = part.split(",", 2);
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string };
  };
};

export type WebhookAction =
  | { kind: "delivered" }
  | { kind: "bounced"; permanent: boolean }
  | { kind: "complained" }
  | { kind: "ignore" };

export function classifyResendEvent(event: ResendWebhookEvent): WebhookAction {
  switch (event.type) {
    case "email.delivered":
      return { kind: "delivered" };
    case "email.bounced": {
      // Bounce sementara (mis. kotak masuk penuh) tidak langsung diblokir.
      const type = (event.data?.bounce?.type || "").toLowerCase();
      return { kind: "bounced", permanent: type !== "transient" };
    }
    case "email.complained":
      return { kind: "complained" };
    default:
      return { kind: "ignore" };
  }
}
