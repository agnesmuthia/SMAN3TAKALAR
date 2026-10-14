import { legacyTextToHtml, sanitizeNewsHtml } from "@/lib/cms/sanitize";
import { newsImagePrefix } from "@/lib/cms/storage";

// Isi artikel. HTML disanitasi ULANG saat ditampilkan (pertahanan berlapis);
// berita lama tanpa HTML ditampilkan sebagai paragraf.
export function ArticleBody({ html, text }: { html: string | null; text: string }) {
  const safe = html ? sanitizeNewsHtml(html, { imagePrefix: newsImagePrefix() }) : legacyTextToHtml(text);
  return <div className="prose-berita article-content" dangerouslySetInnerHTML={{ __html: safe }} />;
}
