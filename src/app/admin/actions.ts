"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import {
  approveAndStartCampaign,
  handleNewsPublished,
  retryFailedDeliveries,
  runCampaignBatch,
} from "@/lib/newsletter/service";
import type { ActionFormState } from "@/components/action-form";

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });

async function guard(): Promise<Awaited<ReturnType<typeof assertAdmin>> | null> {
  try {
    return await assertAdmin();
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Verifikasi & pengguna
// -----------------------------------------------------------------------------

export async function reviewVerificationAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const requestId = z.uuid().safeParse(formData.get("requestId"));
  const decision = formData.get("decision");
  if (!requestId.success || (decision !== "approve" && decision !== "reject")) return fail("Data tidak valid.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  const { error } = await ctx.supabase.rpc("admin_review_verification", {
    p_request_id: requestId.data,
    p_approve: decision === "approve",
    p_note: note,
  });
  if (error) return fail("Gagal memproses permintaan. Mungkin sudah ditinjau admin lain.");
  revalidatePath("/admin/verifikasi");
  return ok(decision === "approve" ? "Permintaan disetujui." : "Permintaan ditolak.");
}

const accessSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["guru", "siswa", "guru_bk", "admin", "none"]),
  status: z.enum(["pending", "active", "disabled"]),
});

export async function setUserAccessAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = accessSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("Data tidak valid.");
  const role = parsed.data.role === "none" ? null : parsed.data.role;

  const { error } = await ctx.supabase.rpc("admin_set_user_access", {
    p_user_id: parsed.data.userId,
    p_role: role,
    p_status: parsed.data.status,
  });
  if (error) {
    if (error.message.includes("last_admin")) return fail("Tidak dapat menonaktifkan/menurunkan admin aktif terakhir.");
    if (error.message.includes("active_needs_role")) return fail("Akun aktif wajib memiliki peran.");
    return fail("Gagal memperbarui akses pengguna.");
  }

  // Blokir/buka sesi di Supabase Auth agar akun nonaktif tidak dapat
  // menyegarkan sesi. Pemeriksaan status di server & RLS tetap berlaku.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.status === "disabled" ? "876000h" : "none",
  });
  if (banError) {
    revalidatePath("/admin/pengguna");
    return fail("Peran tersimpan, tetapi status login di Supabase Auth gagal diperbarui. Coba lagi.");
  }
  revalidatePath("/admin/pengguna");
  return ok("Akses pengguna diperbarui.");
}

// -----------------------------------------------------------------------------
// Berita
// -----------------------------------------------------------------------------

const newsSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200),
  slug: z.string().trim().max(120).optional(),
  excerpt: z.string().trim().max(400, "Ringkasan maksimal 400 karakter."),
  content: z.string().max(50000),
  coverImageUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^https:\/\//.test(v), "URL gambar harus diawali https://"),
  status: z.enum(["draft", "published", "archived"]),
  visibility: z.enum(["public", "internal"]),
  newsletterEligible: z.boolean(),
});

export async function saveNewsAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = newsSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    slug: formData.get("slug") || undefined,
    excerpt: formData.get("excerpt") ?? "",
    content: formData.get("content") ?? "",
    coverImageUrl: formData.get("coverImageUrl") ?? "",
    status: formData.get("status"),
    visibility: formData.get("visibility"),
    newsletterEligible: formData.get("newsletterEligible") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const slug = slugify(v.slug || v.title);
  if (!slug) return fail("Slug tidak valid.");

  let previousStatus: string | null = null;
  let publishedAt: string | null = null;
  if (v.id) {
    const { data: existing } = await ctx.supabase
      .from("news")
      .select("status, published_at")
      .eq("id", v.id)
      .maybeSingle<{ status: string; published_at: string | null }>();
    if (!existing) return fail("Berita tidak ditemukan.");
    previousStatus = existing.status;
    publishedAt = existing.published_at;
  }
  if (v.status === "published" && !publishedAt) publishedAt = new Date().toISOString();

  const row = {
    title: v.title,
    slug,
    excerpt: v.excerpt,
    content: v.content,
    cover_image_url: v.coverImageUrl || null,
    status: v.status,
    visibility: v.visibility,
    newsletter_eligible: v.newsletterEligible,
    published_at: publishedAt,
  };

  const result = v.id
    ? await ctx.supabase.from("news").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("news").insert({ ...row, author_id: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) {
    if (result.error?.code === "23505") return fail("Slug sudah dipakai berita lain.");
    return fail("Berita gagal disimpan.");
  }

  let notice = "";
  if (v.status === "published" && previousStatus !== "published") {
    const autoError = await handleNewsPublished(result.data.id, ctx.user.id);
    if (autoError) notice = ` ${autoError}`;
  }

  revalidatePath("/admin/berita");
  revalidatePath("/berita");
  revalidatePath("/");
  if (!v.id) redirect(`/admin/berita/${result.data.id}?disimpan=1`);
  return ok(`Berita disimpan.${notice}`);
}

export async function deleteNewsAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.from("news").delete().eq("id", id.data);
  if (error) return fail("Berita tidak dapat dihapus (mungkin sudah dipakai di kampanye). Arsipkan saja.");
  revalidatePath("/admin/berita");
  redirect("/admin/berita");
}

// -----------------------------------------------------------------------------
// Langganan berita
// -----------------------------------------------------------------------------

export async function anonymizeSubscriberAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("subscriberId"));
  if (!id.success) return fail("Data tidak valid.");
  if (formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.rpc("newsletter_anonymize_subscriber", { p_subscriber_id: id.data });
  if (error) return fail("Gagal menganonimkan data.");
  revalidatePath("/admin/langganan");
  return ok("Data pelanggan dianonimkan dan alamatnya dimasukkan daftar penolakan.");
}

const campaignSchema = z.object({
  subject: z.string().trim().min(3, "Subjek minimal 3 karakter.").max(150),
  heading: z.string().trim().max(120).optional(),
  intro: z.string().trim().max(1000).optional(),
  templateId: z.uuid().optional(),
  newsIds: z.array(z.uuid()).min(1, "Pilih minimal satu berita.").max(10, "Maksimal 10 berita per buletin."),
});

export async function createCampaignAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = campaignSchema.safeParse({
    subject: formData.get("subject") ?? "",
    heading: formData.get("heading") || undefined,
    intro: formData.get("intro") || undefined,
    templateId: formData.get("templateId") || undefined,
    newsIds: formData.getAll("newsIds").map(String),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;

  const { data: campaign, error } = await ctx.supabase
    .from("newsletter_campaigns")
    .insert({
      subject: v.subject,
      heading: v.heading ?? null,
      intro: v.intro ?? null,
      template_id: v.templateId ?? null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !campaign) return fail("Kampanye gagal dibuat.");

  // Trigger database menolak berita draf/internal/terjadwal.
  const { error: itemsError } = await ctx.supabase
    .from("newsletter_campaign_items")
    .insert(v.newsIds.map((newsId, position) => ({ campaign_id: campaign.id, news_id: newsId, position })));
  if (itemsError) {
    await ctx.supabase.from("newsletter_campaigns").delete().eq("id", campaign.id);
    return fail("Ada berita yang tidak memenuhi aturan distribusi (harus terbit dan publik).");
  }
  revalidatePath("/admin/langganan/kampanye");
  redirect(`/admin/langganan/kampanye/${campaign.id}`);
}

function campaignIdFrom(formData: FormData): string | null {
  const id = z.uuid().safeParse(formData.get("campaignId"));
  return id.success ? id.data : null;
}

function describeRun(result: Awaited<ReturnType<typeof runCampaignBatch>>): State {
  if (!result.ok) return fail(result.error);
  const b = result.batch;
  const summary = `Gelombang ini: ${b.sent} diterima penyedia, ${b.failed} gagal, ${b.skipped} dilewati.`;
  if (b.outcome === "sending") return ok(`${summary} Sisa antrean dilanjutkan otomatis oleh penjadwal atau tombol "Lanjutkan pengiriman".`);
  if (b.outcome === "sent") return ok(`${summary} Kampanye selesai: semua email diterima penyedia.`);
  return fail(`${summary} Kampanye selesai dengan kegagalan; periksa detail pengiriman.`);
}

export async function approveCampaignAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = campaignIdFrom(formData);
  if (!id) return fail("Data tidak valid.");
  if (formData.get("confirm") !== "on") return fail("Centang konfirmasi sebelum mengirim.");
  const result = await approveAndStartCampaign(id, ctx.user.id);
  revalidatePath(`/admin/langganan/kampanye/${id}`);
  return describeRun(result);
}

export async function continueCampaignAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = campaignIdFrom(formData);
  if (!id) return fail("Data tidak valid.");
  const result = await runCampaignBatch(id);
  revalidatePath(`/admin/langganan/kampanye/${id}`);
  return describeRun(result);
}

export async function retryCampaignAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = campaignIdFrom(formData);
  if (!id) return fail("Data tidak valid.");
  const result = await retryFailedDeliveries(id, ctx.user.id);
  revalidatePath(`/admin/langganan/kampanye/${id}`);
  return describeRun(result);
}

export async function cancelCampaignAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = campaignIdFrom(formData);
  if (!id) return fail("Data tidak valid.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("newsletter_campaigns")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "approved", "sending"])
    .select("id");
  if (error || !data?.length) return fail("Kampanye tidak dapat dibatalkan.");
  await db
    .from("newsletter_deliveries")
    .update({ status: "skipped", last_error: "campaign_cancelled" })
    .eq("campaign_id", id)
    .in("status", ["queued", "failed"]);
  await db.from("admin_audit_log").insert({
    actor_id: ctx.user.id,
    action: "newsletter.campaign_cancel",
    target_type: "newsletter_campaign",
    target_id: id,
  });
  revalidatePath(`/admin/langganan/kampanye/${id}`);
  return ok("Kampanye dibatalkan. Email yang sudah diterima penyedia tidak dapat ditarik kembali.");
}

export async function removeCampaignItemAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const id = campaignIdFrom(formData);
  const newsId = z.uuid().safeParse(formData.get("newsId"));
  if (!id || !newsId.success) return fail("Data tidak valid.");
  const { data: campaign } = await ctx.supabase
    .from("newsletter_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle<{ status: string }>();
  if (campaign?.status !== "draft") return fail("Hanya kampanye draf yang dapat diubah.");
  await ctx.supabase.from("newsletter_campaign_items").delete().eq("campaign_id", id).eq("news_id", newsId.data);
  revalidatePath(`/admin/langganan/kampanye/${id}`);
  return ok("Berita dihapus dari kampanye.");
}

const templateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(80),
  heading: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(1000),
  footerNote: z.string().trim().max(500),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format #RRGGBB."),
});

export async function saveTemplateAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = templateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? "",
    heading: formData.get("heading") ?? "",
    intro: formData.get("intro") ?? "",
    footerNote: formData.get("footerNote") ?? "",
    accentColor: formData.get("accentColor") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const { error } = await ctx.supabase
    .from("newsletter_templates")
    .update({ name: v.name, heading: v.heading, intro: v.intro, footer_note: v.footerNote, accent_color: v.accentColor })
    .eq("id", v.id);
  if (error) return fail("Template gagal disimpan.");
  revalidatePath("/admin/langganan/template");
  return ok("Template disimpan.");
}

const settingsSchema = z.object({
  autoMode: z.enum(["off", "draft", "immediate"]),
  workspaceDomain: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), "Domain tidak valid (contoh: sman3takalar.sch.id)."),
});

export async function saveSettingsAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await guard();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = settingsSchema.safeParse({
    autoMode: formData.get("autoMode"),
    workspaceDomain: formData.get("workspaceDomain") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const { error } = await ctx.supabase
    .from("app_settings")
    .update({
      newsletter_auto_mode: parsed.data.autoMode,
      school_workspace_domain: parsed.data.workspaceDomain || null,
      updated_by: ctx.user.id,
    })
    .eq("id", true);
  if (error) return fail("Pengaturan gagal disimpan.");
  await createAdminClient().from("admin_audit_log").insert({
    actor_id: ctx.user.id,
    action: "settings.update",
    target_type: "app_settings",
    details: { newsletter_auto_mode: parsed.data.autoMode, school_workspace_domain: parsed.data.workspaceDomain || null },
  });
  revalidatePath("/admin/pengaturan");
  return ok("Pengaturan disimpan.");
}
