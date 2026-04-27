"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL_CATEGORIES, categoryById } from "@/lib/categories";
import { formatPct, formatTons, formatUSD, iso2For } from "@/lib/format";
import type { Mode, Palette } from "@/components/types";
import type { DashboardCell, DashboardResponse } from "@/app/api/dashboard/route";

const YEAR = 2024;

type CategoryAgg = {
  id: string;
  label: string;
  color: string;
  fob_usd: number;
  kg_liquido: number;
  share: number;
};

export default function ProductView({ mode, palette }: { mode: Mode; palette: Palette }) {
  const [cells, setCells] = useState<DashboardCell[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [partnerCells, setPartnerCells] = useState<DashboardCell[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard?year=${YEAR}&dir=${mode === "exp" ? "EXP" : "IMP"}`)
      .then((r) => r.json())
      .then((d: DashboardResponse) => {
        if (cancelled) return;
        setCells(d.cells);
        setPartnerCells(d.cells);
        setSelected(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const products: CategoryAgg[] = useMemo(() => {
    const map = new Map<string, { fob: number; kg: number }>();
    let total = 0;
    for (const c of cells) {
      const e = map.get(c.category_id) ?? { fob: 0, kg: 0 };
      e.fob += c.fob_usd;
      e.kg += c.kg_liquido;
      map.set(c.category_id, e);
      total += c.fob_usd;
    }
    return ALL_CATEGORIES.filter((cat) => (map.get(cat.id)?.fob ?? 0) > 0).map((cat) => {
      const e = map.get(cat.id)!;
      return {
        id: cat.id,
        label: cat.label,
        color: cat.color,
        fob_usd: e.fob,
        kg_liquido: e.kg,
        share: total > 0 ? e.fob / total : 0,
      };
    }).sort((a, b) => b.fob_usd - a.fob_usd);
  }, [cells]);

  const total = useMemo(() => products.reduce((s, p) => s + p.fob_usd, 0), [products]);
  const maxV = useMemo(() => Math.max(1, ...products.map((p) => p.fob_usd)), [products]);

  // Constellation layout
  const W = 900;
  const H = 620;
  const cx = W / 2;
  const cy = H / 2;
  const nodes = useMemo(() => {
    if (products.length === 0) return [];
    return products.map((p, i) => {
      const angle = (i / products.length) * Math.PI * 2 - Math.PI / 2;
      const ratio = p.fob_usd / maxV;
      const r = 200 + (1 - ratio) * 60;
      return {
        ...p,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        size: 18 + ratio * 40,
      };
    });
  }, [products, maxV]);

  const activeColor = mode === "exp"
    ? `oklch(0.72 0.14 ${palette.expHue})`
    : `oklch(0.70 0.14 ${palette.impHue})`;

  // Top partners for the selected category
  const topPartnersForSelected = useMemo(() => {
    if (!selected) return [];
    const filtered = partnerCells.filter((c) => c.category_id === selected);
    const map = new Map<string, { iso3: string | null; country: string; fob_usd: number }>();
    for (const c of filtered) {
      const k = c.iso3 ?? c.country;
      const e = map.get(k);
      if (e) e.fob_usd += c.fob_usd;
      else
        map.set(k, { iso3: c.iso3, country: c.country, fob_usd: c.fob_usd });
    }
    return Array.from(map.values())
      .sort((a, b) => b.fob_usd - a.fob_usd)
      .slice(0, 6);
  }, [selected, partnerCells]);

  const selectedNode = nodes.find((n) => n.id === selected);

  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "320px 1fr 320px" }}>
      {/* Left: category list */}
      <aside className="flex flex-col overflow-hidden border-r border-slate-800/60 bg-slate-950/40">
        <div className="px-4 pt-4 pb-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Categorias
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-slate-200">
            {mode === "exp" ? "Pauta exportadora" : "Pauta importadora"}
          </div>
        </div>
        <div className="scroll-list flex-1 overflow-y-auto px-2 pb-4">
          {products.map((p, i) => {
            const isSel = selected === p.id;
            const isHov = hovered === p.id;
            return (
              <button
                key={p.id}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(isSel ? null : p.id)}
                className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                  isSel
                    ? "bg-slate-800/80"
                    : isHov
                      ? "bg-slate-800/40"
                      : "hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-4 font-mono text-[10px] tabular-nums text-slate-600">{i + 1}</span>
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span
                    className={`flex-1 truncate text-[12.5px] ${
                      isSel ? "font-medium text-slate-100" : "text-slate-300"
                    }`}
                  >
                    {p.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                    {(p.fob_usd / 1e9).toFixed(1)}
                  </span>
                </div>
                <div className="ml-9 mt-1.5 h-0.5 overflow-hidden rounded-full bg-slate-800/60">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(p.fob_usd / maxV) * 100}%`, background: p.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center: graph */}
      <main className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-[#080912] to-slate-950">
        <div className="pointer-events-none absolute left-8 top-6 z-10 max-w-[280px]">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Pauta · {YEAR}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold leading-[1.05] tracking-tight text-slate-100">
            Grafo de{" "}
            <span style={{ color: activeColor }}>
              {mode === "exp" ? "exportações" : "importações"}
            </span>
            <br />
            <span className="text-slate-500">por categoria</span>
          </h1>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            Cada nó é uma categoria de produto. Tamanho proporcional ao valor FOB {YEAR}.
          </p>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="prod-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.4" />
              <stop offset="60%" stopColor={activeColor} stopOpacity="0.05" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={120} fill="url(#prod-center-glow)" />

          {nodes.map((n) => {
            const isDim = selected !== null && selected !== n.id;
            const w = 0.5 + (n.fob_usd / maxV) * 2.5;
            return (
              <line
                key={`e-${n.id}`}
                x1={cx}
                y1={cy}
                x2={n.x}
                y2={n.y}
                stroke={n.color}
                strokeWidth={w}
                strokeOpacity={isDim ? 0.05 : 0.45}
                strokeLinecap="round"
              />
            );
          })}

          <g>
            <circle cx={cx} cy={cy} r={28} fill="#0d0f1a" stroke={activeColor} strokeWidth="1.5" />
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="700"
              fill="#f5f7ff"
              letterSpacing="1"
            >
              BR
            </text>
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="rgba(180,190,220,0.7)"
              fontFamily="var(--font-mono)"
            >
              PAÍS
            </text>
          </g>

          {nodes.map((n) => {
            const isHov = hovered === n.id;
            const isSel = selected === n.id;
            const isDim = selected !== null && !isSel;
            return (
              <g
                key={`n-${n.id}`}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(isSel ? null : n.id)}
                style={{ cursor: "pointer", opacity: isDim ? 0.3 : 1 }}
              >
                <circle cx={n.x} cy={n.y} r={n.size + 8} fill={n.color} opacity="0.12" />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.size}
                  fill="#0d0f1a"
                  stroke={n.color}
                  strokeWidth={isHov || isSel ? 2 : 1.2}
                />
                <text
                  x={n.x}
                  y={n.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="rgba(235,240,255,0.95)"
                >
                  {n.label.length > 14 ? n.label.split(" ")[0] : n.label}
                </text>
                <text
                  x={n.x}
                  y={n.y + n.size + 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="rgba(180,190,220,0.85)"
                  fontFamily="var(--font-mono)"
                >
                  US$ {(n.fob_usd / 1e9).toFixed(1)}B
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-6 right-8 font-mono text-[10px] text-slate-500">
          {products.length} categorias · {formatUSD(total)} total
        </div>
      </main>

      {/* Right: detail */}
      <aside className="flex flex-col overflow-hidden border-l border-slate-800/60 bg-slate-950/40">
        {selectedNode ? (
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: selectedNode.color }}
              />
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {mode === "exp" ? "Export" : "Import"}
              </span>
            </div>
            <div className="mt-1.5 text-[20px] font-semibold tracking-tight text-slate-100">
              {selectedNode.label}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Valor FOB</div>
                <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-100">
                  {formatUSD(selectedNode.fob_usd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Participação</div>
                <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-100">
                  {formatPct(selectedNode.share)}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Volume</div>
                <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-200">
                  {formatTons(selectedNode.kg_liquido)}
                </div>
              </div>
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-wider text-slate-500">
              Principais parceiros
            </div>
            <div className="mt-2 space-y-1.5">
              {topPartnersForSelected.map((p, i) => {
                const iso2 = iso2For(p.iso3) ?? (p.iso3?.slice(0, 2) ?? "??");
                return (
                  <div key={p.iso3 ?? p.country} className="flex items-center gap-2 text-[12px]">
                    <span className="w-4 font-mono text-slate-600">{i + 1}</span>
                    <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      {iso2}
                    </span>
                    <span className="flex-1 truncate text-slate-300">{p.country}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {(p.fob_usd / 1e9).toFixed(1)}B
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-4 pt-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Resumo
            </div>
            <div className="mt-0.5 text-[13px] font-medium text-slate-200">
              Selecione uma categoria
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
              Clique em qualquer nó do grafo ou da lista pra ver os principais parceiros.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Total {mode === "exp" ? "EXP" : "IMP"}
                </div>
                <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-100">
                  {formatUSD(total)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Categorias</div>
                <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-100">
                  {products.length}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-slate-800/40 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Cypher</div>
          <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-slate-400">
{`MATCH (b:Country {is_brazil:true})
  <-[:TO_COUNTRY]-(tf:TradeFlow {
    direction:"${mode === "exp" ? "EXP" : "IMP"}", year:${YEAR}
  })-[:OF_CHAPTER]->(ch:Chapter)
RETURN ch.code, sum(tf.fob_usd)
ORDER BY 2 DESC`}
          </pre>
        </div>
      </aside>
    </div>
  );
}
