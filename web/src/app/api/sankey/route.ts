import { NextRequest, NextResponse } from "next/server";
import { readTx, toNumber } from "@/lib/neo4j";
import { categoryIdForChapter } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Row = {
  uf: string;
  uf_name: string;
  uf_region: string;
  iso3: string | null;
  country: string;
  chapter: string;
  fob_usd: unknown;
  kg_liquido: unknown;
};

export type SankeyCell = {
  uf: string;
  uf_name: string;
  uf_region: string;
  iso3: string | null;
  country: string;
  category_id: string;
  fob_usd: number;
  kg_liquido: number;
};

export type SankeyResponse = {
  year: number;
  direction: "EXP" | "IMP";
  cells: SankeyCell[];
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
    MATCH (tf)-[:FROM_STATE]->(s:State)
    WHERE c.is_brazil = false
    RETURN s.uf AS uf,
           s.name AS uf_name,
           s.region AS uf_region,
           c.iso3 AS iso3,
           c.name AS country,
           ch.code AS chapter,
           sum(tf.fob_usd) AS fob_usd,
           sum(tf.kg_liquido) AS kg_liquido
    `,
    { year, direction },
  );

  const map = new Map<string, SankeyCell>();
  for (const r of rows) {
    const fob = toNumber(r.fob_usd);
    const kg = toNumber(r.kg_liquido);
    const category_id = categoryIdForChapter(r.chapter);
    const key = `${r.uf}|${r.iso3 ?? "?"}|${category_id}`;
    const existing = map.get(key);
    if (existing) {
      existing.fob_usd += fob;
      existing.kg_liquido += kg;
    } else {
      map.set(key, {
        uf: r.uf,
        uf_name: r.uf_name,
        uf_region: r.uf_region,
        iso3: r.iso3,
        country: r.country,
        category_id,
        fob_usd: fob,
        kg_liquido: kg,
      });
    }
  }

  const response: SankeyResponse = {
    year,
    direction: direction as "EXP" | "IMP",
    cells: Array.from(map.values()),
  };
  return NextResponse.json(response);
}
