"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { subscribeAction, type SubscribeState } from "@/app/langganan/actions";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/site";

const initialState: SubscribeState = { status: "idle", message: "" };

export function SubscribeForm({
  source,
  variant = "light",
}: {
  source: "footer" | "halaman_berita" | "artikel" | "beranda";
  variant?: "light" | "dark";
}) {
  const [state, formAction, pending] = useActionState(subscribeAction, initialState);
  const id = useId();
  const dark = variant === "dark";

  return (
    <section aria-labelledby={`${id}-judul`} className={dark ? "" : "card subscribe-inline"}>
      <h2 id={`${id}-judul`} className={`text-lg font-bold ${dark ? "text-white" : "text-brand-900"}`}>
        Dapatkan Berita Terbaru Sekolah
      </h2>
      <p className={`mt-1 text-sm ${dark ? "text-slate-300" : "text-slate-600"}`}>
        Berlangganan untuk menerima berita dan informasi terbaru dari sekolah melalui email.
      </p>

      {state.status === "success" ? (
        <p role="status" className={`mt-4 rounded-md p-3 text-sm ${dark ? "bg-white/10 text-white" : "bg-green-50 text-green-800"}`}>
          {state.message}
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3" noValidate>
          <input type="hidden" name="source" value={source} />
          {/* Kolom jebakan bot: disembunyikan dari pengguna dan pembaca layar. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={`${id}-website`}>Website</label>
            <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${id}-email`} className="sr-only">Alamat email</label>
            <input
              id={`${id}-email`}
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="nama@contoh.com"
              className="input"
            />
            <button type="submit" className={dark ? "btn-secondary" : "btn-primary"} disabled={pending}>
              {pending ? "Memproses…" : "Berlangganan"}
            </button>
          </div>
          <label className={`flex items-start gap-2 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
            <input type="checkbox" name="consent" required className="mt-0.5" />
            <span>
              {NEWSLETTER_CONSENT_TEXT}{" "}
              <Link href="/kebijakan-privasi#langganan" className="underline">Kebijakan privasi</Link>.
              {" "}Bagi pelajar di bawah 18 tahun, mintalah persetujuan orang tua/wali.
            </span>
          </label>
          {state.status === "error" && (
            <p role="alert" className={`text-sm ${dark ? "text-red-200" : "text-red-700"}`}>{state.message}</p>
          )}
        </form>
      )}
    </section>
  );
}
