"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { newsActionContext } from "@/lib/auth/dal";
import { htmlToText, sanitizeNewsHtml } from "@/lib/cms/sanitize";
import { newsImagePrefix, uploadSiteImage } from "@/lib/cms/storage";
import { slugify } from "@/lib/slug";
import type { ActionFormState } from "@/components/action-form";

// Konten situs dikelola penerbit konten: Super Admin & Admin Website.
// Setiap tulisan juga dibatasi RLS (can_publish_news()).

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });

async function publisher() {
  const ctx = await newsActionContext();
  return ctx?.access.canPublish ? ctx : null;
}

const DENIED = fail("Akses ditolak. Hanya Admin Website atau Super Admin yang dapat mengelola konten ini.");

function dbError(code: string | undefined, fallback: string): State {
  if (code === "23505") return fail("Alamat (slug) sudah dipakai. Ubah judul atau slug.");
  if (code === "23514") return fail("Data tidak memenuhi aturan (periksa tanggal, format URL, atau isian wajib).");
  if (code === "42501") return fail("Anda tidak berhak melakukan perubahan ini.");
  return fail(fallback);
}

// Gambar tunggal: unggahan baru, tetap, atau dihapus.
async function resolveImage(formData: FormData, existing: string | null): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    const upload = await uploadSiteImage(file);
    return upload.ok ? { ok: true, url: upload.url } : upload;
  }
  if (formData.get("removeImage") === "on") return { ok: true, url: null };
  return { ok: true, url: existing };
}

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const optionalHttps = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\//.test(v), "URL harus diawali https://")
  .transform((v) => v || null);

// -----------------------------------------------------------------------------
// Profil sekolah
// -----------------------------------------------------------------------------

const profileSchema = z.object({
  hero_title: optionalText(120),
  hero_subtitle: optionalText(300),
  address: optionalText(300),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Format email tidak valid.")
    .transform((v) => v || null),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^\+?[0-9]{8,16}$/.test(v), "Nomor WhatsApp hanya angka (boleh diawali +).")
    .transform((v) => v || null),
  maps_url: optionalHttps,
  instagram_url: optionalHttps,
  facebook_url: optionalHttps,
  youtube_url: optionalHttps,
  tiktok_url: optionalHttps,
});

export async function saveSiteProfileAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = profileSchema.safeParse(Object.fromEntries(Object.keys(profileSchema.shape).map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const { data: current } = await ctx.supabase.from("site_profile").select("logo_url, hero_image_url").maybeSingle<{ logo_url: string | null; hero_image_url: string | null }>();
  const row: Record<string, unknown> = { ...parsed.data, updated_by: ctx.user.id };

  for (const [field, fileKey, removeKey] of [["logo_url", "logoFile", "removeLogo"], ["hero_image_url", "heroFile", "removeHero"]] as const) {
    const file = formData.get(fileKey);
    if (file instanceof File && file.size > 0) {
      const upload = await uploadSiteImage(file);
      if (!upload.ok) return fail(upload.error);
      row[field] = upload.url;
    } else if (formData.get(removeKey) === "on") {
      row[field] = null;
    } else {
      row[field] = current?.[field] ?? null;
    }
  }

  const { error } = await ctx.supabase.from("site_profile").update(row).eq("id", true);
  if (error) return dbError(error.code, "Profil sekolah gagal disimpan.");
  revalidatePath("/", "layout");
  return ok("Profil sekolah disimpan. Perubahan langsung tampil di website.");
}

// -----------------------------------------------------------------------------
// Halaman
// -----------------------------------------------------------------------------

const pageSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, "Judul minimal 2 karakter.").max(120),
  slug: z.string().trim().max(80).optional(),
  summary: z.string().trim().max(300, "Ringkasan maksimal 300 karakter."),
  contentHtml: z.string().max(200_000, "Isi halaman terlalu panjang."),
  position: z.coerce.number().int().min(0).max(999),
  isPublished: z.boolean(),
});

export async function savePageAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = pageSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    slug: formData.get("slug") || undefined,
    summary: formData.get("summary") ?? "",
    contentHtml: formData.get("contentHtml") ?? "",
    position: formData.get("position") || 0,
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const slug = slugify(v.slug || v.title).slice(0, 80).replace(/-+$/g, "");
  if (!slug) return fail("Slug tidak valid.");
  const contentHtml = sanitizeNewsHtml(v.contentHtml, { imagePrefix: newsImagePrefix() });
  const row = {
    title: v.title,
    slug,
    summary: v.summary,
    content_html: contentHtml,
    content: htmlToText(contentHtml),
    position: v.position,
    is_published: v.isPublished,
    updated_by: ctx.user.id,
  };
  const result = v.id
    ? await ctx.supabase.from("site_pages").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("site_pages").insert(row).select("id").single<{ id: string }>();
  if (result.error || !result.data) return dbError(result.error?.code, "Halaman gagal disimpan.");
  revalidatePath("/profil", "layout");
  revalidatePath("/admin/halaman");
  if (!v.id) redirect(`/admin/halaman/${result.data.id}?disimpan=1`);
  return ok(v.isPublished ? "Halaman disimpan dan tampil di website." : "Halaman disimpan sebagai draf (belum tampil).");
}

export async function deletePageAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("site_pages").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Halaman gagal dihapus.");
  revalidatePath("/profil", "layout");
  redirect("/admin/halaman");
}

// -----------------------------------------------------------------------------
// Program unggulan
// -----------------------------------------------------------------------------

const programSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, "Nama program minimal 2 karakter.").max(100),
  summary: z.string().trim().max(400),
  pageId: z.union([z.uuid(), z.literal("")]),
  position: z.coerce.number().int().min(0).max(999),
  isPublished: z.boolean(),
});

export async function saveProgramAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = programSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    summary: formData.get("summary") ?? "",
    pageId: formData.get("pageId") ?? "",
    position: formData.get("position") || 0,
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  let existing: string | null = null;
  if (v.id) {
    const { data } = await ctx.supabase.from("school_programs").select("image_url").eq("id", v.id).maybeSingle<{ image_url: string | null }>();
    existing = data?.image_url ?? null;
  }
  const image = await resolveImage(formData, existing);
  if (!image.ok) return fail(image.error);
  const row = { title: v.title, summary: v.summary, page_id: v.pageId || null, position: v.position, is_published: v.isPublished, image_url: image.url };
  const { error } = v.id
    ? await ctx.supabase.from("school_programs").update(row).eq("id", v.id)
    : await ctx.supabase.from("school_programs").insert(row);
  if (error) return dbError(error.code, "Program gagal disimpan.");
  revalidatePath("/");
  revalidatePath("/admin/program");
  return ok("Program disimpan.");
}

export async function deleteProgramAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.from("school_programs").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Program gagal dihapus.");
  revalidatePath("/");
  revalidatePath("/admin/program");
  return ok("Program dihapus.");
}

// -----------------------------------------------------------------------------
// Galeri
// -----------------------------------------------------------------------------

const albumSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Judul album minimal 3 karakter.").max(150),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000),
  eventDate: z.union([z.iso.date(), z.literal("")]),
  isPublished: z.boolean(),
  consent: z.boolean(),
});

export async function saveAlbumAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = albumSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    slug: formData.get("slug") || undefined,
    description: formData.get("description") ?? "",
    eventDate: formData.get("eventDate") ?? "",
    isPublished: formData.get("isPublished") === "on",
    consent: formData.get("consent") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;

  let consentAt: string | null = null;
  let consentBy: string | null = null;
  if (v.id) {
    const { data } = await ctx.supabase
      .from("gallery_albums")
      .select("consent_confirmed_at, consent_confirmed_by")
      .eq("id", v.id)
      .maybeSingle<{ consent_confirmed_at: string | null; consent_confirmed_by: string | null }>();
    consentAt = data?.consent_confirmed_at ?? null;
    consentBy = data?.consent_confirmed_by ?? null;
  }
  if (v.consent && !consentAt) {
    consentAt = new Date().toISOString();
    consentBy = ctx.user.id;
  }
  if (v.isPublished && !consentAt) {
    return fail("Centang konfirmasi izin publikasi foto sebelum menerbitkan album.");
  }

  const slug = slugify(v.slug || v.title).slice(0, 100).replace(/-+$/g, "");
  const row = {
    title: v.title,
    slug,
    description: v.description,
    event_date: v.eventDate || null,
    is_published: v.isPublished,
    consent_confirmed_at: consentAt,
    consent_confirmed_by: consentBy,
  };
  const result = v.id
    ? await ctx.supabase.from("gallery_albums").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("gallery_albums").insert({ ...row, created_by: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) return dbError(result.error?.code, "Album gagal disimpan.");
  revalidatePath("/galeri", "layout");
  revalidatePath("/");
  revalidatePath("/admin/galeri");
  if (!v.id) redirect(`/admin/galeri/${result.data.id}?baru=1`);
  return ok(v.isPublished ? "Album disimpan dan tampil di website." : "Album disimpan sebagai draf.");
}

export async function deleteAlbumAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("gallery_albums").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Album gagal dihapus.");
  revalidatePath("/galeri", "layout");
  revalidatePath("/");
  redirect("/admin/galeri");
}

// Dipanggil per foto dari pengunggah (agar tiap permintaan < batas 6 MB).
export async function uploadGalleryPhotoAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await publisher();
  if (!ctx) return { ok: false, error: "Akses ditolak." };
  const albumId = z.uuid().safeParse(formData.get("albumId"));
  const file = formData.get("file");
  if (!albumId.success || !(file instanceof File)) return { ok: false, error: "Data tidak valid." };
  const upload = await uploadSiteImage(file);
  if (!upload.ok) return upload;
  const { count } = await ctx.supabase.from("gallery_photos").select("id", { count: "exact", head: true }).eq("album_id", albumId.data);
  const { error } = await ctx.supabase
    .from("gallery_photos")
    .insert({ album_id: albumId.data, image_url: upload.url, position: (count ?? 0) + 1 });
  if (error) return { ok: false, error: "Foto terunggah tetapi gagal dicatat di album." };
  revalidatePath(`/admin/galeri/${albumId.data}`);
  revalidatePath("/galeri", "layout");
  return { ok: true };
}

const photoSchema = z.object({
  id: z.uuid(),
  albumId: z.uuid(),
  caption: z.string().trim().max(300),
  position: z.coerce.number().int().min(0).max(9999),
  makeCover: z.boolean(),
});

export async function updatePhotoAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = photoSchema.safeParse({
    id: formData.get("id"),
    albumId: formData.get("albumId"),
    caption: formData.get("caption") ?? "",
    position: formData.get("position") || 0,
    makeCover: formData.get("makeCover") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const { error } = await ctx.supabase.from("gallery_photos").update({ caption: v.caption, position: v.position }).eq("id", v.id);
  if (error) return dbError(error.code, "Foto gagal diperbarui.");
  if (v.makeCover) await ctx.supabase.from("gallery_albums").update({ cover_photo_id: v.id }).eq("id", v.albumId);
  revalidatePath(`/admin/galeri/${v.albumId}`);
  revalidatePath("/galeri", "layout");
  return ok("Foto diperbarui.");
}

export async function deletePhotoAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(formData.get("id"));
  const albumId = z.uuid().safeParse(formData.get("albumId"));
  if (!id.success || !albumId.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.from("gallery_photos").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Foto gagal dihapus.");
  revalidatePath(`/admin/galeri/${albumId.data}`);
  revalidatePath("/galeri", "layout");
  return ok("Foto dihapus dari album.");
}

// -----------------------------------------------------------------------------
// Prestasi
// -----------------------------------------------------------------------------

const achievementSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Nama prestasi minimal 3 karakter.").max(200),
  recipient: optionalText(200),
  level: z.enum(["sekolah", "kecamatan", "kabupaten", "provinsi", "nasional", "internasional"]),
  organizer: optionalText(200),
  achievedOn: z.iso.date("Tanggal prestasi wajib diisi."),
  description: z.string().trim().max(2000),
  newsId: z.union([z.uuid(), z.literal("")]),
  isPublished: z.boolean(),
});

export async function saveAchievementAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = achievementSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    recipient: formData.get("recipient") ?? "",
    level: formData.get("level"),
    organizer: formData.get("organizer") ?? "",
    achievedOn: formData.get("achievedOn") ?? "",
    description: formData.get("description") ?? "",
    newsId: formData.get("newsId") ?? "",
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  let existing: string | null = null;
  if (v.id) {
    const { data } = await ctx.supabase.from("achievements").select("image_url").eq("id", v.id).maybeSingle<{ image_url: string | null }>();
    existing = data?.image_url ?? null;
  }
  const image = await resolveImage(formData, existing);
  if (!image.ok) return fail(image.error);
  const row = {
    title: v.title,
    recipient: v.recipient,
    level: v.level,
    organizer: v.organizer,
    achieved_on: v.achievedOn,
    description: v.description,
    news_id: v.newsId || null,
    is_published: v.isPublished,
    image_url: image.url,
  };
  const result = v.id
    ? await ctx.supabase.from("achievements").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("achievements").insert({ ...row, created_by: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) return dbError(result.error?.code, "Prestasi gagal disimpan.");
  revalidatePath("/prestasi");
  revalidatePath("/");
  revalidatePath("/admin/prestasi");
  if (!v.id) redirect(`/admin/prestasi/${result.data.id}?disimpan=1`);
  return ok("Prestasi disimpan.");
}

export async function deleteAchievementAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("achievements").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Prestasi gagal dihapus.");
  revalidatePath("/prestasi");
  revalidatePath("/");
  redirect("/admin/prestasi");
}

// -----------------------------------------------------------------------------
// Kalender
// -----------------------------------------------------------------------------

const timeOpt = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam HH:MM."), z.literal("")]);
const eventSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(3, "Nama kegiatan minimal 3 karakter.").max(150),
    description: z.string().trim().max(1000),
    category: z.enum(["akademik", "ujian", "libur", "kegiatan", "rapat", "lainnya"]),
    startsOn: z.iso.date("Tanggal mulai wajib diisi."),
    endsOn: z.union([z.iso.date(), z.literal("")]),
    startTime: timeOpt,
    endTime: timeOpt,
    location: optionalText(150),
    visibility: z.enum(["public", "internal"]),
    isPublished: z.boolean(),
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai." })
  .refine((v) => !v.startTime || !v.endTime || (v.endsOn && v.endsOn > v.startsOn) || v.endTime > v.startTime, {
    message: "Jam selesai harus setelah jam mulai.",
  });

export async function saveEventAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const parsed = eventSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    location: formData.get("location") ?? "",
    visibility: formData.get("visibility") ?? "public",
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const row = {
    title: v.title,
    description: v.description,
    category: v.category,
    starts_on: v.startsOn,
    ends_on: v.endsOn || v.startsOn,
    start_time: v.startTime || null,
    end_time: v.endTime || null,
    location: v.location,
    visibility: v.visibility,
    is_published: v.isPublished,
  };
  const result = v.id
    ? await ctx.supabase.from("calendar_events").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("calendar_events").insert({ ...row, created_by: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) return dbError(result.error?.code, "Kegiatan gagal disimpan.");
  revalidatePath("/kalender");
  revalidatePath("/");
  revalidatePath("/admin/kalender");
  if (!v.id) redirect(`/admin/kalender?disimpan=1`);
  return ok("Kegiatan disimpan.");
}

export async function deleteEventAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await publisher();
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("calendar_events").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Kegiatan gagal dihapus.");
  revalidatePath("/kalender");
  revalidatePath("/");
  redirect("/admin/kalender");
}
