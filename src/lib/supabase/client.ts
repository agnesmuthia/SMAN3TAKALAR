import { createBrowserClient } from "@supabase/ssr";

// Klien browser: hanya memakai anon key publik. Dipakai untuk memulai alur
// OAuth Google (redirect) dan penautan identitas.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase belum dikonfigurasi.");
  }
  return createBrowserClient(url, anonKey);
}
