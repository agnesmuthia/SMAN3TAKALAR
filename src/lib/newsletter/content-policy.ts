// Aturan distribusi buletin. Hanya berita yang TERBIT, PUBLIK, sudah lewat
// waktu terbitnya, dan ditandai boleh masuk buletin yang dapat dikirim.
// Aturan yang sama juga ditegakkan di database (trigger kampanye).

export type NewsForPolicy = {
  status: string;
  visibility: string;
  newsletter_eligible: boolean;
  published_at: string | null;
};

export function isDistributableNews(news: NewsForPolicy, now: Date = new Date()): boolean {
  if (news.status !== "published") return false;
  if (news.visibility !== "public") return false;
  if (!news.newsletter_eligible) return false;
  if (!news.published_at) return false;
  const published = new Date(news.published_at);
  return !Number.isNaN(published.getTime()) && published.getTime() <= now.getTime();
}
