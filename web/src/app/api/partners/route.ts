import { NextRequest, NextResponse } from "next/server";
import { readTx, toNumber } from "@/lib/neo4j";
import { coordsFor } from "@/lib/country-coords";
import { regionFor } from "@/lib/regions";

export const dynamic = "force-dynamic";

type DirectionalRow = {
  iso3: string | null;
  name: string;
  fob_usd: unknown;
  kg_liquido: unknown;
};

export type Partner = {
  iso3: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  exp_usd: number;
  exp_kg: number;
  imp_usd: number;
  imp_kg: number;
};

export type PartnersResponse = {
  year: number;
  totals: {
    exportacao_usd: number;
    exportacao_kg: number;
    importacao_usd: number;
    importacao_kg: number;
    saldo_usd: number;
    corrente_usd: number;
  };
  partners: Partner[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? "2024");

  // Single Cypher: country-level totals split by direction.
  const rows = await readTx<{
    direction: "EXP" | "IMP";
    iso3: string | null;
    name: string;
    fob_usd: unknown;
    kg_liquido: unknown;
  }>(
    `
    MATCH (tf:TradeFlow {year: $year})-[:TO_COUNTRY]->(c:Country)
    WHERE c.is_brazil = false
    RETURN tf.direction AS direction,
           c.iso3 AS iso3,
           c.name AS name,
           sum(tf.fob_usd)    AS fob_usd,
           sum(tf.kg_liquido) AS kg_liquido
    `,
    { year },
  );

  const byIso3 = new Map<string, Partner>();
  let exp_total_usd = 0;
  let exp_total_kg = 0;
  let imp_total_usd = 0;
  let imp_total_kg = 0;

  for (const r of rows as Array<typeof rows[number] & DirectionalRow>) {
    if (!r.iso3) continue;
    const fob = toNumber(r.fob_usd);
    const kg = toNumber(r.kg_liquido);
    if (r.direction === "EXP") {
      exp_total_usd += fob;
      exp_total_kg += kg;
    } else {
      imp_total_usd += fob;
      imp_total_kg += kg;
    }

    let p = byIso3.get(r.iso3);
    if (!p) {
      const coords = coordsFor(r.iso3);
      if (!coords) continue;
      p = {
        iso3: r.iso3,
        name: r.name,
        lat: coords[0],
        lng: coords[1],
        region: regionFor(r.iso3),
        exp_usd: 0,
        exp_kg: 0,
        imp_usd: 0,
        imp_kg: 0,
      };
      byIso3.set(r.iso3, p);
    }
    if (r.direction === "EXP") {
      p.exp_usd = fob;
      p.exp_kg = kg;
    } else {
      p.imp_usd = fob;
      p.imp_kg = kg;
    }
  }

  // Sort by total trade volume (corrente bilateral) desc — typical default ranking
  const partners = Array.from(byIso3.values()).sort(
    (a, b) => (b.exp_usd + b.imp_usd) - (a.exp_usd + a.imp_usd),
  );

  const response: PartnersResponse = {
    year,
    totals: {
      exportacao_usd: exp_total_usd,
      exportacao_kg: exp_total_kg,
      importacao_usd: imp_total_usd,
      importacao_kg: imp_total_kg,
      saldo_usd: exp_total_usd - imp_total_usd,
      corrente_usd: exp_total_usd + imp_total_usd,
    },
    partners,
  };

  return NextResponse.json(response);
}
