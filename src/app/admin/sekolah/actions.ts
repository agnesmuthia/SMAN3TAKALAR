"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";
import type { ActionFormState } from "@/components/action-form";
import { staffActionContext } from "@/lib/auth/dal";
import { uploadSiteImage } from "@/lib/cms/storage";
import { removePdf, uploadPdf } from "@/lib/school/documents";
import {
  MAX_IMPORT_BYTES,
  detectSpreadsheetType,
  parseCsv,
  recheckBeforeCommit,
  validateScheduleRows,
  type Cell,
  type ExistingEntry,
  type ValidRow,
} from "@/lib/school/schedule-import";

// Data administrasi sekolah: Super Admin & Petugas Administrasi.
// Perpustakaan: penerbit konten & Petugas Administrasi. Semua tulisan juga
// dibatasi RLS di database.

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });
const DENIED = fail("Akses ditolak. Fitur ini untuk Super Admin dan Petugas Administrasi.");

async function schoolAdmin() {
  const ctx = await staffActionContext();
  return ctx?.access.canManageSchool ? ctx : null;
}

async function libraryManager() {
  const ctx = await staffActionContext();
  return ctx?.access.canManageLibrary ? ctx : null;
}

function dbError(code: string | undefined, fallback: string): State {
  if (code === "23505") return fail("Data yang sama sudah ada.");
  if (code === "23503") return fail("Data masih dipakai (misalnya semester yang punya jadwal) sehingga tidak dapat dihapus.");
  if (code === "23514") return fail("Data tidak memenuhi aturan (periksa tanggal, format, atau konfirmasi wajib).");
  if (code === "42501") return fail("Anda tidak berhak melakukan perubahan ini.");
  return fail(fallback);
}

const isoDate = (msg: string) => z.iso.date(msg);
const uuid = z.uuid();

// -----------------------------------------------------------------------------
// Tahun ajaran & semester
// -----------------------------------------------------------------------------

const yearSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Tulis tahun ajaran seperti 2026/2027."),
    startsOn: isoDate("Tanggal mulai wajib diisi."),
    endsOn: isoDate("Tanggal selesai wajib diisi."),
  })
  .refine((v) => Number(v.name.slice(5)) === Number(v.name.slice(0, 4)) + 1, { message: "Tahun kedua harus tahun pertama + 1 (mis. 2026/2027)." })
  .refine((v) => v.endsOn > v.startsOn, { message: "Tanggal selesai harus setelah tanggal mulai." });

export async function saveAcademicYearAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const parsed = yearSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const row = { name: v.name, starts_on: v.startsOn, ends_on: v.endsOn };
  const { error } = v.id
    ? await ctx.supabase.from("academic_years").update(row).eq("id", v.id)
    : await ctx.supabase.from("academic_years").insert(row);
  if (error) return error.code === "23505" ? fail("Tahun ajaran itu sudah ada.") : dbError(error.code, "Tahun ajaran gagal disimpan.");
  revalidatePath("/admin/tahun-ajaran");
  return ok(v.id ? "Tahun ajaran diperbarui." : "Tahun ajaran ditambahkan. Lanjutkan dengan menambah semester.");
}

export async function deleteAcademicYearAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("academic_years").delete().eq("id", id.data);
  if (error) {
    if (error.code === "23503") return fail("Hapus semesternya terlebih dahulu (tahun ajaran masih punya semester).");
    return dbError(error.code, "Tahun ajaran gagal dihapus.");
  }
  revalidatePath("/admin/tahun-ajaran");
  return ok("Tahun ajaran dihapus.");
}

const semesterSchema = z
  .object({
    id: z.uuid().optional(),
    academicYearId: z.uuid("Pilih tahun ajaran."),
    term: z.coerce.number().int().min(1).max(2),
    startsOn: isoDate("Tanggal mulai wajib diisi."),
    endsOn: isoDate("Tanggal selesai wajib diisi."),
  })
  .refine((v) => v.endsOn > v.startsOn, { message: "Tanggal selesai harus setelah tanggal mulai." });

export async function saveSemesterAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const parsed = semesterSchema.safeParse({
    id: formData.get("id") || undefined,
    academicYearId: formData.get("academicYearId"),
    term: formData.get("term"),
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const { data: year } = await ctx.supabase
    .from("academic_years")
    .select("starts_on, ends_on")
    .eq("id", v.academicYearId)
    .maybeSingle<{ starts_on: string; ends_on: string }>();
  if (!year) return fail("Tahun ajaran tidak ditemukan.");
  if (v.startsOn < year.starts_on || v.endsOn > year.ends_on) return fail("Tanggal semester harus berada di dalam rentang tahun ajarannya.");
  const row = { academic_year_id: v.academicYearId, term: v.term, starts_on: v.startsOn, ends_on: v.endsOn };
  const { error } = v.id
    ? await ctx.supabase.from("semesters").update(row).eq("id", v.id)
    : await ctx.supabase.from("semesters").insert(row);
  if (error) return error.code === "23505" ? fail("Semester itu sudah ada pada tahun ajaran ini.") : dbError(error.code, "Semester gagal disimpan.");
  revalidatePath("/admin/tahun-ajaran");
  return ok("Semester disimpan.");
}

export async function setActiveSemesterAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.rpc("set_active_semester", { p_semester: id.data });
  if (error) return dbError(error.code, "Semester gagal diaktifkan.");
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return ok("Semester aktif diganti. Siswa dan guru kini melihat jadwal semester ini.");
}

export async function deleteSemesterAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("semesters").delete().eq("id", id.data);
  if (error) {
    if (error.code === "23503") return fail("Semester masih punya jadwal pelajaran. Jadwal tidak dihapus otomatis demi keamanan data.");
    return dbError(error.code, "Semester gagal dihapus.");
  }
  revalidatePath("/admin/tahun-ajaran");
  return ok("Semester dihapus.");
}

// -----------------------------------------------------------------------------
// Jadwal manual
// -----------------------------------------------------------------------------

const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM.");
const scheduleSchema = z
  .object({
    semesterId: z.uuid("Pilih semester."),
    className: z.string().trim().min(1, "Kelas wajib diisi.").max(40),
    day: z.coerce.number().int().min(1).max(6),
    start: timeField,
    end: timeField,
    subject: z.string().trim().min(1, "Mata pelajaran wajib diisi.").max(100),
    teacherId: z.union([z.uuid(), z.literal("")]),
    room: z.string().trim().max(40),
  })
  .refine((v) => v.end > v.start, { message: "Jam selesai harus setelah jam mulai.", path: ["end"] });

async function existingEntries(ctx: NonNullable<Awaited<ReturnType<typeof schoolAdmin>>>, semesterId: string): Promise<ExistingEntry[]> {
  const { data } = await ctx.supabase
    .from("schedule_entries")
    .select("class_name, day_of_week, start_time, end_time, subject, teacher_id")
    .eq("semester_id", semesterId)
    .limit(10000);
  return (data ?? []) as ExistingEntry[];
}

export async function saveScheduleEntryAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const parsed = scheduleSchema.safeParse({
    semesterId: formData.get("semesterId"),
    className: formData.get("className") ?? "",
    day: formData.get("day"),
    start: formData.get("start") ?? "",
    end: formData.get("end") ?? "",
    subject: formData.get("subject") ?? "",
    teacherId: formData.get("teacherId") ?? "",
    room: formData.get("room") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const row: ValidRow = {
    class_name: v.className, day_of_week: v.day, start_time: v.start, end_time: v.end,
    subject: v.subject, teacher_id: v.teacherId || null, room: v.room || null,
  };
  const conflicts = recheckBeforeCommit([row], await existingEntries(ctx, v.semesterId));
  if (conflicts.length > 0) return fail(conflicts[0]);
  const { error } = await ctx.supabase.from("schedule_entries").insert({ ...row, semester_id: v.semesterId });
  if (error) return error.code === "23505" ? fail("Kelas itu sudah punya sesi yang mulai pada jam yang sama.") : dbError(error.code, "Jadwal gagal disimpan.");
  revalidatePath("/admin/jadwal");
  return ok("Jadwal ditambahkan.");
}

export async function deleteScheduleEntryAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.from("schedule_entries").delete().eq("id", id.data);
  if (error) return dbError(error.code, "Jadwal gagal dihapus.");
  revalidatePath("/admin/jadwal");
  return ok("Jadwal dihapus.");
}

// -----------------------------------------------------------------------------
// Impor jadwal: unggah → pratinjau (tanpa menulis jadwal) → impor baris valid
// -----------------------------------------------------------------------------

async function readRows(file: File): Promise<{ ok: true; rows: Cell[][] } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pilih file CSV atau XLSX." };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "Ukuran file maksimal 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectSpreadsheetType(bytes, file.name);
  if (!type) return { ok: false, error: "Format file harus .csv atau .xlsx (file .xls lama: simpan ulang sebagai .xlsx)." };
  try {
    if (type === "csv") return { ok: true, rows: parseCsv(new TextDecoder("utf-8").decode(bytes)) };
    const rows = (await readSheet(Buffer.from(bytes))) as unknown as Cell[][];
    return { ok: true, rows };
  } catch (error) {
    console.error("[impor] gagal membaca file:", error instanceof Error ? error.message : error);
    return { ok: false, error: "File tidak dapat dibaca. Pastikan file tidak rusak dan data ada di sheet pertama." };
  }
}

export async function previewScheduleImportAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const semesterId = uuid.safeParse(formData.get("semesterId"));
  if (!semesterId.success) return fail("Pilih semester tujuan.");
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Pilih file CSV atau XLSX.");
  const read = await readRows(file);
  if (!read.ok) return fail(read.error);

  const [{ data: teachers }, existing] = await Promise.all([
    ctx.supabase.rpc("list_active_teachers"),
    existingEntries(ctx, semesterId.data),
  ]);
  const teacherList = ((teachers ?? []) as { id: string; full_name: string | null }[])
    .filter((t) => t.full_name)
    .map((t) => ({ id: t.id, name: t.full_name as string }));
  const validated = validateScheduleRows(read.rows, { teachers: teacherList, existing });
  if (!validated.ok) return fail(validated.error);
  const { counts, report, valid } = validated.result;

  const { data: batch, error } = await ctx.supabase
    .from("schedule_import_batches")
    .insert({
      semester_id: semesterId.data,
      file_name: file.name.slice(0, 200) || "jadwal",
      total_rows: counts.total,
      valid_count: counts.valid,
      existing_count: counts.existing,
      error_count: counts.error,
      valid_rows: valid,
      report,
      created_by: ctx.user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !batch) return dbError(error?.code, "Pratinjau gagal disimpan.");
  redirect(`/admin/jadwal/impor/${batch.id}`);
}

export async function commitScheduleImportAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { data: batch } = await ctx.supabase
    .from("schedule_import_batches")
    .select("semester_id, status, valid_rows")
    .eq("id", id.data)
    .maybeSingle<{ semester_id: string; status: string; valid_rows: ValidRow[] }>();
  if (!batch) return fail("Pratinjau tidak ditemukan.");
  if (batch.status !== "pratinjau") return fail("Pratinjau ini sudah diproses.");
  if (batch.valid_rows.length === 0) return fail("Tidak ada baris valid untuk diimpor.");
  const problems = recheckBeforeCommit(batch.valid_rows, await existingEntries(ctx, batch.semester_id));
  if (problems.length > 0) {
    return fail(`Jadwal berubah sejak pratinjau dibuat (${problems.length} bentrok baru, mis. ${problems[0]}). Buang pratinjau ini lalu unggah ulang file.`);
  }
  const { data: inserted, error } = await ctx.supabase.rpc("commit_schedule_import", { p_batch: id.data });
  if (error) return dbError(error.code, "Impor gagal. Tidak ada jadwal yang berubah.");
  revalidatePath("/admin/jadwal", "layout");
  revalidatePath("/dashboard", "layout");
  return ok(`${inserted} sesi jadwal berhasil diimpor.`);
}

export async function discardScheduleImportAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.from("schedule_import_batches").delete().eq("id", id.data).eq("status", "pratinjau");
  if (error) return dbError(error.code, "Pratinjau gagal dibuang.");
  redirect("/admin/jadwal/impor");
}

export async function revertScheduleImportAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { data: deleted, error } = await ctx.supabase.rpc("revert_schedule_import", { p_batch: id.data });
  if (error) return dbError(error.code, "Impor gagal dibatalkan.");
  revalidatePath("/admin/jadwal", "layout");
  revalidatePath("/dashboard", "layout");
  return ok(`Impor dibatalkan: ${deleted} sesi dari file ini dihapus. Jadwal lain tidak berubah.`);
}

// -----------------------------------------------------------------------------
// Arsip SK
// -----------------------------------------------------------------------------

const decreeSchema = z.object({
  id: z.uuid().optional(),
  number: z.string().trim().min(1, "Nomor SK wajib diisi.").max(120),
  title: z.string().trim().min(3, "Perihal/judul SK minimal 3 karakter.").max(300),
  issuedOn: isoDate("Tanggal SK wajib diisi."),
  issuer: z.string().trim().max(150).transform((v) => v || null),
  academicYearId: z.union([z.uuid(), z.literal("")]),
  status: z.enum(["berlaku", "arsip"]),
  visibility: z.enum(["public", "internal"]),
  isPublished: z.boolean(),
  verified: z.boolean(),
});

export async function saveDecreeAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const parsed = decreeSchema.safeParse({
    id: formData.get("id") || undefined,
    number: formData.get("number") ?? "",
    title: formData.get("title") ?? "",
    issuedOn: formData.get("issuedOn") ?? "",
    issuer: formData.get("issuer") ?? "",
    academicYearId: formData.get("academicYearId") ?? "",
    status: formData.get("status") ?? "berlaku",
    visibility: formData.get("visibility") ?? "internal",
    isPublished: formData.get("isPublished") === "on",
    verified: formData.get("verified") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  if (v.isPublished && !v.verified) return fail("Centang konfirmasi pemeriksaan sebelum menampilkan SK.");

  let existing: { file_path: string; verified_at: string | null } | null = null;
  if (v.id) {
    const { data } = await ctx.supabase.from("decrees").select("file_path, verified_at").eq("id", v.id).maybeSingle<{ file_path: string; verified_at: string | null }>();
    if (!data) return fail("SK tidak ditemukan.");
    existing = data;
  }

  const file = formData.get("file");
  let upload: { path: string; size: number } | null = null;
  if (file instanceof File && file.size > 0) {
    const result = await uploadPdf("sk", file);
    if (!result.ok) return fail(result.error);
    upload = result;
  } else if (!existing) {
    return fail("Unggah file PDF SK.");
  }

  // File baru = isi berubah, jadi konfirmasi pemeriksaan dicatat ulang.
  const verifiedNow = v.verified && (upload !== null || !existing?.verified_at);
  const row = {
    number: v.number,
    title: v.title,
    issued_on: v.issuedOn,
    issuer: v.issuer,
    academic_year_id: v.academicYearId || null,
    status: v.status,
    visibility: v.visibility,
    is_published: v.isPublished,
    ...(upload ? { file_path: upload.path, file_size: upload.size } : {}),
    ...(verifiedNow ? { verified_at: new Date().toISOString(), verified_by: ctx.user.id } : {}),
    ...(!v.verified ? { verified_at: null, verified_by: null } : {}),
  };
  const result = v.id
    ? await ctx.supabase.from("decrees").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("decrees").insert({ ...row, created_by: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) {
    if (upload) await removePdf(upload.path);
    if (result.error?.code === "23505") return fail("Nomor SK dengan tanggal yang sama sudah ada di arsip.");
    return dbError(result.error?.code, "SK gagal disimpan.");
  }
  if (upload && existing) await removePdf(existing.file_path);
  revalidatePath("/admin/arsip-sk", "layout");
  revalidatePath("/dokumen");
  if (!v.id) redirect(`/admin/arsip-sk/${result.data.id}?disimpan=1`);
  return ok(v.isPublished ? "SK disimpan dan ditampilkan." : "SK disimpan (belum ditampilkan).");
}

export async function deleteDecreeAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await schoolAdmin();
  if (!ctx) return DENIED;
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { data, error } = await ctx.supabase.from("decrees").delete().eq("id", id.data).select("file_path").maybeSingle<{ file_path: string }>();
  if (error) return dbError(error.code, "SK gagal dihapus.");
  if (data) await removePdf(data.file_path);
  revalidatePath("/dokumen");
  redirect("/admin/arsip-sk");
}

// -----------------------------------------------------------------------------
// Perpustakaan digital
// -----------------------------------------------------------------------------

const librarySchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200),
  author: z.string().trim().max(200).transform((v) => v || null),
  category: z.string().trim().min(1, "Kategori wajib diisi.").max(60),
  description: z.string().trim().max(1000),
  kind: z.enum(["tautan", "pdf"]),
  url: z.string().trim().max(1000),
  visibility: z.enum(["public", "internal"]),
  isPublished: z.boolean(),
  rights: z.boolean(),
});

export async function saveLibraryItemAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await libraryManager();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = librarySchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    author: formData.get("author") ?? "",
    category: formData.get("category") ?? "Umum",
    description: formData.get("description") ?? "",
    kind: formData.get("kind") ?? "tautan",
    url: formData.get("url") ?? "",
    visibility: formData.get("visibility") ?? "public",
    isPublished: formData.get("isPublished") === "on",
    rights: formData.get("rights") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;

  type Existing = { file_path: string | null; cover_image_url: string | null; rights_confirmed_at: string | null };
  let existing: Existing | null = null;
  if (v.id) {
    const { data } = await ctx.supabase
      .from("library_items")
      .select("file_path, cover_image_url, rights_confirmed_at")
      .eq("id", v.id)
      .maybeSingle<Existing>();
    if (!data) return fail("Koleksi tidak ditemukan.");
    existing = data;
  }

  let url: string | null = null;
  let upload: { path: string; size: number } | null = null;
  if (v.kind === "tautan") {
    if (!/^https:\/\/[^\s]+$/.test(v.url)) return fail("Tautan harus diawali https://");
    url = v.url;
  } else {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const result = await uploadPdf("perpustakaan", file);
      if (!result.ok) return fail(result.error);
      upload = result;
    } else if (!existing?.file_path) {
      return fail("Unggah file PDF.");
    }
    if (v.isPublished && !v.rights) return fail("Centang konfirmasi bahwa sekolah berhak membagikan PDF ini.");
  }

  let cover = existing?.cover_image_url ?? null;
  const coverFile = formData.get("imageFile");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await uploadSiteImage(coverFile);
    if (!result.ok) {
      if (upload) await removePdf(upload.path);
      return fail(result.error);
    }
    cover = result.url;
  } else if (formData.get("removeImage") === "on") {
    cover = null;
  }

  const confirmed = v.kind === "pdf" && v.rights;
  const rightsFields = !confirmed
    ? { rights_confirmed_at: null, rights_confirmed_by: null }
    : upload || !existing?.rights_confirmed_at
      ? { rights_confirmed_at: new Date().toISOString(), rights_confirmed_by: ctx.user.id }
      : {};
  const filePath = v.kind === "pdf" ? upload?.path ?? existing?.file_path ?? null : null;
  const row = {
    title: v.title,
    author: v.author,
    category: v.category,
    description: v.description,
    kind: v.kind,
    url,
    file_path: filePath,
    file_size: v.kind === "pdf" ? upload?.size ?? undefined : null,
    cover_image_url: cover,
    visibility: v.visibility,
    is_published: v.isPublished,
    ...rightsFields,
  };
  const result = v.id
    ? await ctx.supabase.from("library_items").update(row).eq("id", v.id).select("id").single<{ id: string }>()
    : await ctx.supabase.from("library_items").insert({ ...row, created_by: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) {
    if (upload) await removePdf(upload.path);
    return dbError(result.error?.code, "Koleksi gagal disimpan.");
  }
  // File lama dibersihkan bila diganti atau jenis koleksi berubah menjadi tautan.
  if (existing?.file_path && existing.file_path !== filePath) await removePdf(existing.file_path);
  revalidatePath("/admin/perpustakaan", "layout");
  revalidatePath("/perpustakaan");
  if (!v.id) redirect(`/admin/perpustakaan/${result.data.id}?disimpan=1`);
  return ok("Koleksi disimpan.");
}

export async function deleteLibraryItemAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await libraryManager();
  if (!ctx) return fail("Akses ditolak.");
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success || formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { data, error } = await ctx.supabase.from("library_items").delete().eq("id", id.data).select("file_path").maybeSingle<{ file_path: string | null }>();
  if (error) return dbError(error.code, "Koleksi gagal dihapus.");
  if (data?.file_path) await removePdf(data.file_path);
  revalidatePath("/perpustakaan");
  redirect("/admin/perpustakaan");
}
