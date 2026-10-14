import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv, supabaseServiceRoleKey } from "@/lib/env";

// Klien service role: MELEWATI RLS. Hanya dipakai di server untuk alur yang
// tidak punya sesi pengguna (langganan publik, pengiriman, webhook) atau
// setelah pemeriksaan admin eksplisit. Jangan pernah diimpor dari komponen
// klien.
export function createAdminClient() {
  const { url } = supabasePublicEnv();
  return createClient(url, supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
