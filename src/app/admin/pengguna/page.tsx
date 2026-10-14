import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABEL, STATUS_LABEL, type AccountStatus, type UserRole } from "@/lib/auth/types";
import { setStaffRolesAction, setStudentClassAction, setUserAccessAction } from "../actions";

export const metadata: Metadata = { title: "Pengguna" };

const PER_PAGE = 50;

export default async function PenggunaPage({ searchParams }: PageProps<"/admin/pengguna">) {
  const ctx = await requireRole(["admin"], "/admin/pengguna");
  const sp = await searchParams;
  const pageRaw = Number(typeof sp.halaman === "string" ? sp.halaman : "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // Email diambil dari Supabase Auth (service role) setelah pemeriksaan admin.
  const { data: list } = await createAdminClient().auth.admin.listUsers({ page, perPage: PER_PAGE });
  const users = list?.users ?? [];
  const ids = users.map((u) => u.id);
  const { data: profiles } = ids.length
    ? await ctx.supabase.from("profiles").select("id, full_name, role, status, class_name").in("id", ids)
    : { data: [] };
  const { data: staff } = ids.length
    ? await ctx.supabase.from("staff_roles").select("user_id, role").in("user_id", ids)
    : { data: [] };
  const staffById = new Map<string, Set<string>>();
  for (const r of (staff ?? []) as { user_id: string; role: string }[]) {
    if (!staffById.has(r.user_id)) staffById.set(r.user_id, new Set());
    staffById.get(r.user_id)!.add(r.role);
  }
  const byId = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; role: UserRole | null; status: AccountStatus; class_name: string | null }[]).map((p) => [p.id, p]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Pengguna</h1>
        <p className="mt-1 text-sm text-slate-600">
          Peran Guru BK dan admin hanya ditetapkan di sini oleh admin. Peran CMS (Editor: menulis &amp; mengirim
          berita; Admin Website: menyetujui &amp; menerbitkan) dapat diberikan kepada akun aktif, mis. guru humas. Menonaktifkan akun langsung mencabut akses
          ke fitur privat.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Email / Nama</th>
              <th className="px-4 py-2">Metode</th>
              <th className="px-4 py-2">Saat ini</th>
              <th className="px-4 py-2">Ubah akses</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const p = byId.get(u.id);
              return (
                <tr key={u.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.email}</p>
                    <p className="text-slate-500">{p?.full_name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{(u.identities ?? []).map((i) => i.provider).join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    {p?.role ? ROLE_LABEL[p.role] : "Tanpa peran"}
                    <br />
                    <span className="text-slate-500">{p ? STATUS_LABEL[p.status] : "—"}</span>
                    {p?.status === "active" && p.role !== "admin" && (
                      <ActionForm action={setStaffRolesAction} submitLabel="Simpan peran staf" className="mt-2 flex flex-wrap items-center gap-3 text-xs" submitClassName="btn-secondary !px-2 !py-1 text-xs">
                        <input type="hidden" name="userId" value={u.id} />
                        <span className="text-slate-500">Peran staf:</span>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="staffRoles" value="editor" defaultChecked={staffById.get(u.id)?.has("editor")} /> Editor
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="staffRoles" value="admin_website" defaultChecked={staffById.get(u.id)?.has("admin_website")} /> Admin Website
                        </label>
                        {p.role !== "siswa" && (
                          <label className="flex items-center gap-1">
                            <input type="checkbox" name="staffRoles" value="administrasi" defaultChecked={staffById.get(u.id)?.has("administrasi")} /> Petugas Administrasi
                          </label>
                        )}
                      </ActionForm>
                    )}
                    {p?.role === "siswa" && (
                      <ActionForm action={setStudentClassAction} submitLabel="Simpan kelas" className="mt-2 flex items-center gap-2" submitClassName="btn-secondary !px-2 !py-1 text-xs">
                        <input type="hidden" name="userId" value={u.id} />
                        <label className="sr-only" htmlFor={`kelas-${u.id}`}>Kelas</label>
                        <input id={`kelas-${u.id}`} name="className" defaultValue={p.class_name ?? ""} maxLength={40} placeholder="Kelas" className="input !w-24 !py-1" />
                      </ActionForm>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ActionForm action={setUserAccessAction} submitLabel="Simpan" className="flex flex-wrap items-center gap-2" submitClassName="btn-secondary">
                      <input type="hidden" name="userId" value={u.id} />
                      <label className="sr-only" htmlFor={`role-${u.id}`}>Peran</label>
                      <select id={`role-${u.id}`} name="role" defaultValue={p?.role ?? "none"} className="input w-auto">
                        <option value="none">Tanpa peran</option>
                        <option value="guru">Guru</option>
                        <option value="siswa">Siswa</option>
                        <option value="guru_bk">Guru BK</option>
                        <option value="admin">Admin</option>
                      </select>
                      <label className="sr-only" htmlFor={`status-${u.id}`}>Status</label>
                      <select id={`status-${u.id}`} name="status" defaultValue={p?.status ?? "pending"} className="input w-auto">
                        <option value="pending">Menunggu</option>
                        <option value="active">Aktif</option>
                        <option value="disabled">Nonaktif</option>
                      </select>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav className="flex gap-3 text-sm">
        {page > 1 && <Link href={`/admin/pengguna?halaman=${page - 1}`} className="btn-secondary">← Sebelumnya</Link>}
        {users.length === PER_PAGE && <Link href={`/admin/pengguna?halaman=${page + 1}`} className="btn-secondary">Berikutnya →</Link>}
      </nav>
    </div>
  );
}
