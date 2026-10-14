"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { submitRasaReportAction, type RasaSubmitState } from "@/app/ruang-rasa/actions";
import { CATEGORY_LABEL, RASA_CATEGORIES } from "@/lib/rasa/labels";

const initial: RasaSubmitState = { status: "idle", message: "" };

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-navy-900" translate="no">{value}</p>
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-teal-700 hover:underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* tidak apa-apa: pengguna dapat menyalin manual */
          }
        }}
      >
        {copied ? "Tersalin ✓" : "Salin"}
      </button>
    </div>
  );
}

export function RasaReportForm() {
  const [state, formAction, pending] = useActionState(submitRasaReportAction, initial);
  const id = useId();

  if (state.status === "success" && state.code && state.pin) {
    return (
      <div className="space-y-5" role="status">
        <div className="rounded-2xl border-l-4 border-teal-600 bg-teal-50 p-5">
          <h2 className="text-xl font-bold text-navy-900">Terima kasih sudah berani bercerita 💙</h2>
          <p className="mt-2 text-sm text-slate-700">Laporanmu sudah diterima. Guru BK yang bertugas akan membacanya.</p>
        </div>
        <div className="rounded-2xl border-2 border-gold-500 bg-gold-500/10 p-5">
          <h3 className="font-bold text-navy-900">Simpan kode dan PIN ini sekarang</h3>
          <p className="mt-1 text-sm text-slate-700">
            Kode dan PIN <strong>hanya tampil sekali</strong> dan tidak dapat ditampilkan lagi, bahkan oleh sekolah. Tanpa keduanya kamu tidak dapat melihat
            balasan. Catat di kertas atau simpan di tempat yang aman, dan jangan bagikan ke siapa pun.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CopyField label="Kode laporan" value={state.code} />
            <CopyField label="PIN rahasia" value={state.pin} />
          </div>
        </div>
        <p className="text-sm text-slate-700">
          Untuk melihat balasan atau menambah cerita, buka <Link href="/ruang-rasa/cek" className="font-semibold text-teal-700 underline">Cek laporan</Link> dan
          masukkan kode dan PIN tadi.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-web`}>Website</label>
        <input id={`${id}-web`} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor={`${id}-cat`} className="label">Kejadian apa yang ingin kamu laporkan?</label>
        <select id={`${id}-cat`} name="category" required defaultValue="" className="input">
          <option value="" disabled>Pilih salah satu…</option>
          {RASA_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-body`} className="label">Ceritakan apa yang terjadi</label>
        <textarea
          id={`${id}-body`}
          name="body"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          className="input"
          placeholder="Tulis dengan bahasamu sendiri. Kamu boleh menyebut siapa yang terlibat, tapi tidak wajib menulis namamu."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-when`} className="label">Kapan kejadiannya? (boleh dikosongkan)</label>
          <input id={`${id}-when`} name="when" maxLength={200} className="input" placeholder="mis. Senin lalu, saat istirahat" />
        </div>
        <div>
          <label htmlFor={`${id}-where`} className="label">Di mana? (boleh dikosongkan)</label>
          <input id={`${id}-where`} name="where" maxLength={200} className="input" placeholder="mis. kantin, kelas, grup chat" />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <input type="checkbox" name="urgent" className="mt-1" />
        <span>
          <strong>Ini mendesak</strong>: ada seseorang yang sedang terancam atau terus disakiti. Laporan ini akan diletakkan di urutan atas.
          <span className="block text-xs text-slate-600">Menandai mendesak tidak menggantikan bantuan langsung. Jika bahaya terjadi sekarang, segera cari guru atau orang dewasa terdekat.</span>
        </span>
      </label>

      <div>
        <label htmlFor={`${id}-contact`} className="label">Cara Guru BK menghubungimu (boleh dikosongkan)</label>
        <input id={`${id}-contact`} name="contact" maxLength={200} className="input" placeholder="mis. nama panggilan dan kelas, atau biarkan kosong untuk tetap anonim" />
        <p className="mt-1 text-xs text-slate-600">
          Jika dikosongkan, laporanmu sepenuhnya anonim dan kamu tetap bisa menerima balasan lewat kode dan PIN.
        </p>
      </div>

      {state.status === "error" && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Mengirim…" : "Kirim laporan"}
      </button>
    </form>
  );
}
