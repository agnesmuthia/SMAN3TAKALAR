import { slugify } from "@/lib/slug";

// "Lomba, Sains,  lomba " -> [{name:"Lomba",slug:"lomba"},{name:"Sains",slug:"sains"}]
export function parseTagInput(raw: string, max = 10): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const result: { name: string; slug: string }[] = [];
  for (const part of (raw ?? "").split(",")) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, 40);
    const slug = slugify(name).slice(0, 40).replace(/-+$/g, "");
    if (name.length < 2 || !slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push({ name, slug });
    if (result.length >= max) break;
  }
  return result;
}
