// Macro-categories mapping NCM chapters (2-digit codes) to plain-language
// Portuguese buckets, for non-expert audiences. Covers ~95% of Brazilian
// trade value; remaining chapters fall into "outros".

export type Category = {
  id: string;
  label: string;
  color: string; // hex color used in charts and legends
  chapters: string[]; // NCM chapter codes (2 digits, zero-padded)
};

export const CATEGORIES: Category[] = [
  {
    id: "graos",
    label: "Grãos e soja",
    color: "#f59e0b", // amber
    chapters: ["10", "12"],
  },
  {
    id: "carnes",
    label: "Carnes e pescados",
    color: "#ef4444", // red
    chapters: ["02", "03", "16"],
  },
  {
    id: "cafe_acucar",
    label: "Café, açúcar e sucos",
    color: "#fb923c", // orange
    chapters: ["09", "17", "20"],
  },
  {
    id: "celulose",
    label: "Celulose e papel",
    color: "#10b981", // emerald
    chapters: ["47", "48", "49"],
  },
  {
    id: "minerios",
    label: "Minérios e metais",
    color: "#64748b", // slate
    chapters: ["26", "72", "73", "74", "75", "76", "78", "79", "80", "81"],
  },
  {
    id: "petroleo",
    label: "Petróleo e combustíveis",
    color: "#7c3aed", // violet
    chapters: ["27"],
  },
  {
    id: "quimicos",
    label: "Químicos e fertilizantes",
    color: "#38bdf8", // sky
    chapters: ["28", "29", "30", "31", "32", "33", "38", "39", "40"],
  },
  {
    id: "maquinas",
    label: "Máquinas e eletrônicos",
    color: "#06b6d4", // cyan
    chapters: ["84", "85"],
  },
  {
    id: "veiculos",
    label: "Veículos e aeronaves",
    color: "#ec4899", // pink
    chapters: ["87", "88", "89", "86"],
  },
];

export const OUTROS_CATEGORY: Category = {
  id: "outros",
  label: "Outros",
  color: "#94a3b8", // slate-400
  chapters: [],
};

// Lookup table: chapter → category id
const CHAPTER_TO_CATEGORY = new Map<string, string>();
for (const cat of CATEGORIES) {
  for (const ch of cat.chapters) {
    CHAPTER_TO_CATEGORY.set(ch, cat.id);
  }
}

export function categoryIdForChapter(chapter: string): string {
  return CHAPTER_TO_CATEGORY.get(chapter) ?? "outros";
}

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? OUTROS_CATEGORY;
}

export const ALL_CATEGORIES: Category[] = [...CATEGORIES, OUTROS_CATEGORY];

// Chapters covered by a set of category ids, for Cypher IN filters.
// If "outros" is in the set, chapters NOT in any other mapped category count.
export function chaptersForCategories(ids: string[], knownChapters: string[]): string[] {
  if (ids.length === 0) return [];
  const result = new Set<string>();
  const wantsOutros = ids.includes("outros");
  const mappedIds = ids.filter((id) => id !== "outros");
  for (const id of mappedIds) {
    const cat = CATEGORIES.find((c) => c.id === id);
    if (cat) cat.chapters.forEach((ch) => result.add(ch));
  }
  if (wantsOutros) {
    const mappedSet = new Set(CATEGORIES.flatMap((c) => c.chapters));
    for (const ch of knownChapters) {
      if (!mappedSet.has(ch)) result.add(ch);
    }
  }
  return Array.from(result);
}
