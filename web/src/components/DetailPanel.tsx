"use client";

import { useMemo } from "react";
import { ALL_CATEGORIES, categoryById, categoryIdForChapter } from "@/lib/categories";
import { formatPct, formatTons, formatUSD, iso2For } from "@/lib/format";
import type { Mode } from "@/components/types";
import type { DashboardCell } from "@/app/api/dashboard/route";
import type { Partner } from "@/app/api/partners/route";

export type DetailPanelProps = {
  selected: string | null;
  partners: Partner[];
  mode: Mode;
  // Combined cells for both directions of the year (we filter by direction here)
  cellsExp: DashboardCell[];
  cellsImp: DashboardCell[];
};

type CategoryAgg = { id: string; fob_usd: number; kg_liquido: number };

function aggregateCategories(cells: DashboardCell[]): CategoryAgg[] {
  const map = new Map<string, CategoryAgg>();
  for (const c of cells) {
    const existing = map.get(c.category_id);
    if (existing) {
      existing.fob_usd += c.fob_usd;
      existing.kg_liquido += c.kg_liquido;
    } else {
      map.set(c.category_id, { id: c.category_id, fob_usd: c.fob_usd, kg_liquido: c.kg_liquido });
    }
  }
  // Order: canonical (mapped categories first, "outros" last), drop zero rows
  return ALL_CATEGORIES.map(
    (cat) => map.get(cat.id) ?? { id: cat.id, fob_usd: 0, kg_liquido: 0 },
  )
    .filter((c) => c.fob_usd > 0)
    .sort((a, b) => b.fob_usd - a.fob_usd);
}

export default function DetailPanel({
  selected,
  partners,
  mode,
  cellsExp,
  cellsImp,
}: DetailPanelProps) {
  const partner = partners.find((p) => p.iso3 === selected);
  const accentClass = mode === "exp" ? "bg-emerald-500/60" : "bg-violet-500/60";

  // Default view (no partner): top categories overall for this direction
  const overallTop = useMemo(
    () => aggregateCategories(mode === "exp" ? cellsExp : cellsImp).slice(0, 8),
    [mode, cellsExp, cellsImp],
  );
  const overallTotal = useMemo(
    () => overallTop.reduce((s, c) => s + c.fob_usd, 0),
    [overallTop],
  );
  const overallMax = overallTop[0]?.fob_usd ?? 1;

  // Partner-specific
  const partnerCells = useMemo(() => {
    if (!partner) return [];
    const src = mode === "exp" ? cellsExp : cellsImp;
    return src.filter((c) => c.iso3 === partner.iso3);
  }, [partner, mode, cellsExp, cellsImp]);
  const partnerTop = useMemo(
    () => aggregateCategories(partnerCells).slice(0, 5),
    [partnerCells],
  );

  if (!partner) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4 pb-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Categorias
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-slate-200">
            {mode === "exp" ? "Pauta exportadora" : "Pauta importadora"}
          </div>
        </div>
        <div className="scroll-list flex-1 overflow-y-auto px-4 pb-4">
          {overallTop.map((c) => {
            const cat = categoryById(c.id);
            const pct = (c.fob_usd / overallMax) * 100;
            const share = c.fob_usd / overallTotal;
            return (
              <div key={c.id} className="border-b border-slate-800/40 py-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: cat.color }}
                    />
                    <span className="truncate text-[13px] font-medium text-slate-200">
                      {cat.label}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[13px] tabular-nums text-slate-100">
                      {formatUSD(c.fob_usd)}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {formatPct(share)} · {formatTons(c.kg_liquido)}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-800/60">
                  <div
                    className="h-full"
                    style={{ width: `${pct}%`, background: cat.color, opacity: 0.65 }}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-4 rounded-md border border-slate-800/60 bg-slate-900/40 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Cypher
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-slate-400">
{`MATCH (b:Country {is_brazil:true})
  <-[:TO_COUNTRY]-(tf:TradeFlow {
    direction:"${mode === "exp" ? "EXP" : "IMP"}", year:2024
  })-[:OF_CHAPTER]->(ch:Chapter)
RETURN ch.code, sum(tf.fob_usd) AS fob
ORDER BY fob DESC LIMIT 8`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Partner detail
  const balance = partner.exp_usd - partner.imp_usd;
  const expPct = (partner.exp_usd / (partner.exp_usd + partner.imp_usd || 1)) * 100;
  const impPct = 100 - expPct;
  const iso2 = iso2For(partner.iso3) ?? partner.iso3.slice(0, 2);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/40 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-slate-400">
            {iso2}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {partner.region}
          </span>
        </div>
        <div className="mt-1.5 text-[20px] font-semibold tracking-tight text-slate-100">
          {partner.name}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-slate-800/40 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Exportação BR→{iso2}
          </div>
          <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-emerald-200">
            {formatUSD(partner.exp_usd)}
          </div>
          <div className="text-[10px] tabular-nums text-slate-500">
            {formatTons(partner.exp_kg)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Importação BR←{iso2}
          </div>
          <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-violet-200">
            {formatUSD(partner.imp_usd)}
          </div>
          <div className="text-[10px] tabular-nums text-slate-500">
            {formatTons(partner.imp_kg)}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Saldo bilateral
          </div>
          <div
            className={`mt-0.5 text-[17px] font-semibold tabular-nums ${
              balance >= 0 ? "text-emerald-200" : "text-rose-300"
            }`}
          >
            {balance >= 0 ? "+" : ""}
            {formatUSD(Math.abs(balance))}
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-800/60">
            <div className="h-full bg-emerald-500/70" style={{ width: `${expPct}%` }} />
            <div className="h-full bg-violet-500/70" style={{ width: `${impPct}%` }} />
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {mode === "exp" ? "Top exportações pra " : "Top importações de "}
          {partner.name}
        </div>
        <div className="mt-2 space-y-2">
          {partnerTop.map((c, i) => {
            const cat = categoryById(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2 text-[12px]">
                <span className="w-4 font-mono text-slate-600">{i + 1}</span>
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: cat.color }}
                />
                <span className="flex-1 truncate text-slate-300">{cat.label}</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {formatUSD(c.fob_usd)}
                </span>
              </div>
            );
          })}
          {partnerTop.length === 0 && (
            <div className="text-[12px] text-slate-500">
              Sem fluxos {mode === "exp" ? "exportados" : "importados"} no ano.
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-slate-800/40 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Cypher</div>
        <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-slate-400">
{`MATCH (b:Country {is_brazil:true})
  <-[:TO_COUNTRY]-(tf:TradeFlow {
    direction:"${mode === "exp" ? "EXP" : "IMP"}", year:2024
  })-[:OF_CHAPTER]->(:Chapter)
WHERE (tf)-[:TO_COUNTRY]->(:Country {iso3:"${partner.iso3}"})
RETURN sum(tf.fob_usd), sum(tf.kg_liquido)`}
        </pre>
      </div>
    </div>
  );
}

// Helper for App.tsx: derive cellsExp + cellsImp by fetching /api/dashboard for each direction.
// We re-export categoryIdForChapter so callers can reason about the data model symmetrically.
export { categoryIdForChapter };
