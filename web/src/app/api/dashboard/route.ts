import { NextRequest, NextResponse } from "next/server";
import { readTx, toNumber } from "@/lib/neo4j";
import { categoryIdForChapter } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Row = {
  iso3: string | null;
  name: string;
  chapter: string;
  fob_usd: unknown;
  kg_liquido: unknown;
};

// The response is unpivoted: one row per (country, category) pair with the
// FOB/kg summed across chapters. The client groups/cross-filters locally —
// total payload is ~1k rows for a full year.
export type DashboardCell = {
  iso3: string | null;
  country: string;
  category_id: string;
  fob_usd: number;
  kg_liquido: number;
};

export type DashboardResponse = {
  year: number;
  direction: "EXP" | "IMP";
  total_fob_usd: number;
  total_kg: number;
  cells: DashboardCell[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? "2024");
  const direction = (searchParams.get("dir") ?? "EXP").toUpperCase();

  if (!["EXP", "IMP"].includes(direction)) {
    return NextResponse.json({ error: "dir must be EXP or IMP" }, { status: 400 });
  }

  const rows = await readTx<Row>(
    `
    MATCH (tf:TradeFlow {year: $year, direction: $direction})-[:OF_CHAPTER]->(ch:Chapter)
    MATCH (tf)-[:TO_COUNTRY]->(c:Country)
    WHERE c.is_brazil = false
    RETURN c.iso3  AS iso3,
           c.name  AS name,
           ch.code AS chapter,
           sum(tf.fob_usd)    AS fob_usd,
           sum(tf.kg_liquido) AS kg_liquido
    `,
    { year, direction },
  );

  // Roll chapters up to categories; one cell per (country, category) pair.
  const cellsMap = new Map<string, DashboardCell>();
  let total_fob = 0;
  let total_kg = 0;
  for (const r of rows) {
    const fob = toNumber(r.fob_usd);
    const kg = toNumber(r.kg_liquido);
    total_fob += fob;
    total_kg += kg;
    const category_id = categoryIdForChapter(r.chapter);
    const key = `${r.iso3 ?? "?"}:${category_id}`;
    const existing = cellsMap.get(key);
    if (existing) {
      existing.fob_usd += fob;
      existing.kg_liquido += kg;
    } else {
      cellsMap.set(key, {
        iso3: r.iso3,
        country: r.name,
        category_id,
        fob_usd: fob,
        kg_liquido: kg,
      });
    }
  }

  const response: DashboardResponse = {
    year,
    direction: direction as "EXP" | "IMP",
    total_fob_usd: total_fob,
    total_kg: total_kg,
    cells: Array.from(cellsMap.values()),
  };

  return NextResponse.json(response);
}
