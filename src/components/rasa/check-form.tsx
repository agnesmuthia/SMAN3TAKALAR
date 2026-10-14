"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { checkRasaAction, type RasaCheckState } from "@/app/ruang-rasa/actions";
import { CATEGORY_LABEL, REPORTER_STATUS_LABEL } from "@/lib/rasa/labels";

const initial: RasaCheckState = { status: "idle", message: "" };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export function RasaCheckForm() {
  const [state, formAction, pending] = useActionState(checkRasaAction, initial);
  const id = useId();
  const view = state.view;

  return (
    <div className="space-y-6">
      {!view && (
        <form action={formAction} className="space-y-4" autoComplete="off">
          <input type="hidden" name="intent" value="cek" />
          <div>
            <label htmlFor={`${id}-code`} className="label">Kode laporan</label>
            <input id={`${id}-code`} name="code" required className="input font-mono uppercase" placeholder="RSA-XXXX-XXXX" autoComplete="off" spellCheck={false} />
          </div>
          <div>
            <label htmlFor={`${id}-pin`} className="label">PIN rahasia</label>
            <input id={`${id}-pin`} name="pin" required type="password" className="input font-mono uppercase" placeholder="XXXX-XXXX" autoComplete="off" spellCheck={false} />
          </div>
          {state.status === "error" && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Memeriksa…" : "Buka laporan"}</button>
        </form>
      )}

      {view && (
        <div className="space-y-5">
          <div className="rounded-2xl border-l-4 border-teal-600 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{CATEGORY_LABEL[view.category]} · dikirim {fmt.format(new Date(view.createdAt))}</p>
            <p className="mt-2 font-semibold text-navy-900">{REPORTER_STATUS_LABEL[view.status]}</p>
          </div>

          <section aria-labelledby={`${id}-pesan`}>
            <h2 id={`${id}-pesan`} className="font-semibold text-navy-900">Percakapan</h2>
            {view.messages.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Belum ada balasan. Silakan cek lagi nanti. Guru BK tidak memantau laporan sepanjang waktu.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {view.messages.map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-2xl p-4 text-sm ${m.sender === "bk" ? "bg-teal-50 text-slate-800" : "ml-auto bg-navy-900 text-white"}`}>
                    <p className="text-xs font-semibold opacity-80">{m.sender === "bk" ? "Guru BK" : "Kamu"} · {fmt.format(new Date(m.createdAt))}</p>
                    <p className="mt-1 whitespace-pre-line">{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {state.status === "ok" && state.message && <p role="status" className="text-sm text-green-700">{state.message}</p>}
          {view.status !== "selesai" ? (
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="intent" value="balas" />
              <input type="hidden" name="code" value={state.code} />
              <input type="hidden" name="pin" value={state.pin} />
              <label htmlFor={`${id}-text`} className="label">Tambah pesan</label>
              <textarea id={`${id}-text`} name="text" required maxLength={3000} rows={4} className="input" />
              {state.status === "error" && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Mengirim…" : "Kirim pesan"}</button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">
              Laporan ini sudah selesai. Jika masih ada yang mengganggumu, kamu boleh <Link href="/ruang-rasa" className="font-semibold text-teal-700 underline">membuat laporan baru</Link>.
            </p>
          )}
          <p className="text-xs text-slate-500">Tutup halaman ini bila selesai; kode dan PIN tidak disimpan di peramban.</p>
        </div>
      )}
    </div>
  );
}
