import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";

export type SiteProfile = {
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  maps_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
};

const COLUMNS =
  "hero_title, hero_subtitle, hero_image_url, logo_url, address, phone, email, whatsapp, maps_url, instagram_url, facebook_url, youtube_url, tiktok_url";

const EMPTY: SiteProfile = {
  hero_title: null, hero_subtitle: null, hero_image_url: null, logo_url: null, address: null, phone: null,
  email: null, whatsapp: null, maps_url: null, instagram_url: null, facebook_url: null, youtube_url: null, tiktok_url: null,
};

// Profil sekolah dari CMS; nilai kosong jatuh ke environment variables lama.
export const getSiteProfile = cache(async (): Promise<SiteProfile> => {
  await connection();
  let row: Partial<SiteProfile> = {};
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.from("site_profile").select(COLUMNS).maybeSingle<SiteProfile>();
    row = data ?? {};
  }
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== "")),
    logo_url: row.logo_url || siteConfig.logoUrl,
    address: row.address || siteConfig.contact.address,
    phone: row.phone || siteConfig.contact.phone,
    email: row.email || siteConfig.contact.email,
  } as SiteProfile;
});
