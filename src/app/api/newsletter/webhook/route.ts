import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resendWebhookSecret } from "@/lib/env";
import { emailHash } from "@/lib/newsletter/email";
import { classifyResendEvent, verifyWebhookSignature, type ResendWebhookEvent } from "@/lib/newsletter/webhook";

// Webhook status pengiriman dari Resend: bounce & keluhan spam dimasukkan ke
// daftar penolakan agar tidak dikirimi lagi. Payload mentah tidak disimpan.
export async function POST(request: NextRequest) {
  const secret = resendWebhookSecret();
  if (!secret) return new NextResponse("Webhook belum dikonfigurasi.", { status: 503 });

  const body = await request.text();
  const id = request.headers.get("svix-id");
  const valid = verifyWebhookSignature({
    id,
    timestamp: request.headers.get("svix-timestamp"),
    signatureHeader: request.headers.get("svix-signature"),
    body,
    secret,
  });
  if (!valid) return new NextResponse("Tanda tangan tidak valid.", { status: 401 });

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(body) as ResendWebhookEvent;
  } catch {
    return new NextResponse("Payload tidak valid.", { status: 400 });
  }

  const action = classifyResendEvent(event);
  const messageId = event.data?.email_id ?? null;
  const db = createAdminClient();

  const { data: delivery } = messageId
    ? await db
        .from("newsletter_deliveries")
        .select("id, subscriber_id, newsletter_subscribers(email)")
        .eq("provider_message_id", messageId)
        .maybeSingle<{ id: string; subscriber_id: string; newsletter_subscribers: { email: string | null } | null }>()
    : { data: null };

  // Idempoten: svix-id unik, pengiriman ulang webhook diabaikan.
  const { error: eventError } = await db.from("newsletter_delivery_events").insert({
    provider_event_id: id,
    delivery_id: delivery?.id ?? null,
    provider_message_id: messageId,
    event_type: String(event.type).slice(0, 50),
    occurred_at: event.created_at ?? null,
  });
  if (eventError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });

  if (action.kind === "bounced" || action.kind === "complained") {
    if (delivery) {
      await db
        .from("newsletter_deliveries")
        .update({ status: action.kind === "bounced" ? "bounced" : "complained" })
        .eq("id", delivery.id);
    }
    const permanent = action.kind === "complained" || action.permanent;
    // Utamakan alamat dari database; bila email bukan buletin (mis. email
    // konfirmasi), pakai alamat penerima di payload.
    const address = delivery?.newsletter_subscribers?.email ?? event.data?.to?.[0] ?? null;
    if (permanent && address) {
      await db
        .from("newsletter_suppression_records")
        .upsert({ email_hash: emailHash(address), reason: action.kind === "bounced" ? "bounced" : "complained" });
      if (delivery) {
        await db
          .from("newsletter_subscribers")
          .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
          .eq("id", delivery.subscriber_id)
          .neq("status", "unsubscribed");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
