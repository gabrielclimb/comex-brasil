"use client";

import { useEffect, useMemo, useState } from "react";
import MultiPicker from "@/components/MultiPicker";
import { ALL_CATEGORIES, categoryById } from "@/lib/categories";
import { formatUSD } from "@/lib/format";
import type { Mode, Palette } from "@/components/types";
import type { SankeyCell, SankeyResponse } from "@/app/api/sankey/route";

const YEAR = 2024;

type Item = {
  id: string;
  code: string;
  label: string;
  value: number; // in billions, for picker display
};

type Node = {
  id: string;
  label: string;
  code: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Link = {
  from: Node;
  to: Node;
  value: number;
  fromY?: number;
  fromH?: number;
  toY?: number;
  toH?: number;
};

const REGIOES_UF: Record<string, string[]> = {
  Sudeste: ["SP", "RJ", "MG", "ES"],
  Sul: ["PR", "SC", "RS"],
  "Centro-Oeste": ["MT", "MS", "GO", "DF"],
  Nordeste: ["BA", "PE", "CE", "MA", "PI", "RN", "PB", "AL", "SE"],
  Norte: ["PA", "AM", "TO", "RO", "AP", "AC", "RR"],
};

function ribbonPath(x1: number, y1: number, h1: number, x2: number, y2: number, h2: number): string {
  const cx1 = x1 + (x2 - x1) * 0.45;
  const cx2 = x1 + (x2 - x1) * 0.55;
  return `M${x1},${y1}
    C${cx1},${y1} ${cx2},${y2} ${x2},${y2}
    L${x2},${y2 + h2}
    C${cx2},${y2 + h2} ${cx1},${y1 + h1} ${x1},${y1 + h1}
    Z`;
}

export default function SankeyView({ mode, palette }: { mode: Mode; palette: Palette }) {
  const [data, setData] = useState<SankeyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hovUF, setHovUF] = useState<string | null>(null);
  const [hovCat, setHovCat] = useState<string | null>(null);
  const [hovCty, setHovCty] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/sankey?year=${YEAR}&dir=${mode === "exp" ? "EXP" : "IMP"}`)
      .then((r) => r.json())
      .then((d: SankeyResponse) => !cancelled && setData(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Build sortable lists from cells
  const { allUFs, allCategories, allPartners } = useMemo(() => {
    if (!data) return { allUFs: [], allCategories: [], allPartners: [] } as { allUFs: Item[]; allCategories: Item[]; allPartners: Item[] };
    const ufMap = new Map<string, Item>();
    const catMap = new Map<string, Item>();
    const ctyMap = new Map<string, Item>();
    for (const c of data.cells) {
      const ufKey = c.uf;
      const u = ufMap.get(ufKey);
      if (u) u.value += c.fob_usd;
      else ufMap.set(ufKey, { id: ufKey, code: c.uf, label: c.uf_name || c.uf, value: c.fob_usd });

      const catKey = c.category_id;
      const ct = catMap.get(catKey);
      if (ct) ct.value += c.fob_usd;
      else
        catMap.set(catKey, {
          id: catKey,
          code: catKey.slice(0, 5).toUpperCase(),
          label: categoryById(catKey).label,
          value: c.fob_usd,
        });

      const ctyKey = c.iso3 ?? c.country;
      const cy = ctyMap.get(ctyKey);
      if (cy) cy.value += c.fob_usd;
      else
        ctyMap.set(ctyKey, {
          id: ctyKey,
          code: c.iso3?.slice(0, 2) ?? "?",
          label: c.country,
          value: c.fob_usd,
        });
    }
    // sort desc, value in billions
    const sortAndScale = (m: Map<string, Item>) =>
      Array.from(m.values())
        .sort((a, b) => b.value - a.value)
        .map((x) => ({ ...x, value: x.value / 1e9 }));
    return {
      allUFs: sortAndScale(ufMap),
      allCategories: sortAndScale(catMap),
      allPartners: sortAndScale(ctyMap),
    };
  }, [data]);

  const [selectedUFs, setSelectedUFs] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedPaises, setSelectedPaises] = useState<Set<string>>(new Set());

  // Initialize once with sensible defaults when data arrives
  useEffect(() => {
    if (allUFs.length && selectedUFs.size === 0) {
      setSelectedUFs(new Set(allUFs.slice(0, 12).map((x) => x.id)));
    }
    if (allCategories.length && selectedCats.size === 0) {
      setSelectedCats(new Set(allCategories.slice(0, 8).map((x) => x.id)));
    }
    if (allPartners.length && selectedPaises.size === 0) {
      setSelectedPaises(new Set(allPartners.slice(0, 12).map((x) => x.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUFs, allCategories, allPartners]);

  const ufs = useMemo(() => allUFs.filter((u) => selectedUFs.has(u.id)), [allUFs, selectedUFs]);
  const cats = useMemo(() => allCategories.filter((c) => selectedCats.has(c.id)), [allCategories, selectedCats]);
  const partners = useMemo(
    () => allPartners.filter((p) => selectedPaises.has(p.id)),
    [allPartners, selectedPaises],
  );

  // Layout
  const W = 980;
  const H = 900;
  const colX = [80, W / 2 - 30, W - 80 - 60];
  const totalUF = ufs.reduce((s, u) => s + u.value, 0);
  const totalCat = cats.reduce((s, c) => s + c.value, 0);
  const totalCty = partners.reduce((s, p) => s + p.value, 0);
  const innerH = H - 60;

  const ufNodes = useMemo<Node[]>(() => {
    let y = 30;
    return ufs.map((u) => {
      const h = Math.max(3, (u.value / (totalUF || 1)) * innerH);
      const node: Node = { id: u.id, label: u.label, code: u.code, value: u.value, x: colX[0], y, w: 14, h };
      y += h + 2;
      return node;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ufs, totalUF]);

  const catNodes = useMemo<Node[]>(() => {
    let y = 30;
    return cats.map((c) => {
      const h = Math.max(3, (c.value / (totalCat || 1)) * innerH);
      const node: Node = { id: c.id, label: c.label, code: c.code, value: c.value, x: colX[1], y, w: 14, h };
      y += h + 2;
      return node;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, totalCat]);

  const ctyNodes = useMemo<Node[]>(() => {
    let y = 30;
    return partners.map((p) => {
      const h = Math.max(3, (p.value / (totalCty || 1)) * innerH);
      const node: Node = { id: p.id, label: p.label, code: p.code, value: p.value, x: colX[2], y, w: 14, h };
      y += h + 2;
      return node;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners, totalCty]);

  // Build links from real cells (only those that match all 3 filters)
  const { links1, links2 } = useMemo(() => {
    if (!data || !ufNodes.length || !catNodes.length || !ctyNodes.length) {
      return { links1: [] as Link[], links2: [] as Link[] };
    }
    const ufById = new Map(ufNodes.map((n) => [n.id, n]));
    const catById = new Map(catNodes.map((n) => [n.id, n]));
    const ctyById = new Map(ctyNodes.map((n) => [n.id, n]));

    // links1: UF → Category
    const k1 = new Map<string, Link>();
    // links2: Category → Country
    const k2 = new Map<string, Link>();
    for (const c of data.cells) {
      const uf = ufById.get(c.uf);
      const cat = catById.get(c.category_id);
      const ctyId = c.iso3 ?? c.country;
      const cty = ctyById.get(ctyId);
      if (!uf || !cat || !cty) continue;
      const v = c.fob_usd / 1e9;
      const k1key = `${uf.id}|${cat.id}`;
      const e1 = k1.get(k1key);
      if (e1) e1.value += v;
      else k1.set(k1key, { from: uf, to: cat, value: v });
      const k2key = `${cat.id}|${cty.id}`;
      const e2 = k2.get(k2key);
      if (e2) e2.value += v;
      else k2.set(k2key, { from: cat, to: cty, value: v });
    }
    return { links1: Array.from(k1.values()), links2: Array.from(k2.values()) };
  }, [data, ufNodes, catNodes, ctyNodes]);

  // Stack links at each node
  const stacked = useMemo(() => {
    const stack = (nodes: Node[], links: Link[], side: "right" | "left") => {
      for (const n of nodes) {
        const totalAt =
          side === "right"
            ? links.filter((l) => l.from.id === n.id).reduce((s, l) => s + l.value, 0)
            : links.filter((l) => l.to.id === n.id).reduce((s, l) => s + l.value, 0);
        if (totalAt === 0) continue;
        const ls = links
          .filter((l) => (side === "right" ? l.from.id === n.id : l.to.id === n.id))
          .sort((a, b) => {
            const ay = side === "right" ? a.to.y : a.from.y;
            const by = side === "right" ? b.to.y : b.from.y;
            return ay - by;
          });
        let y = n.y;
        for (const l of ls) {
          const h = n.h * (l.value / totalAt);
          if (side === "right") {
            l.fromY = y;
            l.fromH = h;
          } else {
            l.toY = y;
            l.toH = h;
          }
          y += h;
        }
      }
    };
    const l1 = links1.map((l) => ({ ...l }));
    const l2 = links2.map((l) => ({ ...l }));
    stack(ufNodes, l1, "right");
    stack(catNodes, l1, "left");
    stack(catNodes, l2, "right");
    stack(ctyNodes, l2, "left");
    return { l1, l2 };
  }, [links1, links2, ufNodes, catNodes, ctyNodes]);

  const isEmpty = ufs.length === 0 || cats.length === 0 || partners.length === 0;
  const activeColor = mode === "exp" ? `oklch(0.72 0.14 ${palette.expHue})` : `oklch(0.70 0.14 ${palette.impHue})`;

  const isLink1Active = (l: Link) => {
    if (!hovUF && !hovCat && !hovCty) return true;
    if (hovUF && l.from.id === hovUF) return true;
    if (hovCat && l.to.id === hovCat) return true;
    return false;
  };
  const isLink2Active = (l: Link) => {
    if (!hovUF && !hovCat && !hovCty) return true;
    if (hovCat && l.from.id === hovCat) return true;
    if (hovCty && l.to.id === hovCty) return true;
    return false;
  };

  const dominantTriple = useMemo(() => {
    if (!ufNodes.length || !catNodes.length || !ctyNodes.length) return null;
    const u = ufNodes[0];
    const c = catNodes[0];
    const p = ctyNodes[0];
    const v = (u.value / (totalUF || 1)) * (c.value / (totalCat || 1)) * p.value;
    return { uf: u, cat: c, cty: p, v };
  }, [ufNodes, catNodes, ctyNodes, totalUF, totalCat]);

  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 320px" }}>
      <main className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-[#080912] to-slate-950">
        <div className="pointer-events-none absolute left-8 top-6 z-10 max-w-[320px]">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Sankey · {YEAR}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold leading-[1.05] tracking-tight text-slate-100">
            UF → Categoria →{" "}
            <span style={{ color: activeColor }}>{mode === "exp" ? "destino" : "origem"}</span>
          </h1>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            Como as {mode === "exp" ? "exportações" : "importações"} brasileiras fluem
            das UFs, passam por cada categoria e chegam aos parceiros.
            {loading && <span className="ml-2 text-slate-600">(carregando…)</span>}
          </p>
        </div>

        <div className="absolute right-8 top-6 z-20 flex items-center gap-2">
          <MultiPicker
            label="UF"
            items={allUFs}
            selected={selectedUFs}
            onChange={setSelectedUFs}
            getId={(u) => u.id}
            getCode={(u) => u.code}
            getLabel={(u) => u.label}
            getValue={(u) => u.value}
            presets={Object.entries(REGIOES_UF).map(([label, ids]) => ({ label, ids }))}
          />
          <MultiPicker
            label="Categoria"
            items={allCategories}
            selected={selectedCats}
            onChange={setSelectedCats}
            getId={(c) => c.id}
            getCode={(c) => c.code}
            getLabel={(c) => c.label}
            getValue={(c) => c.value}
          />
          <MultiPicker
            label={mode === "exp" ? "Destino" : "Origem"}
            items={allPartners}
            selected={selectedPaises}
            onChange={setSelectedPaises}
            getId={(p) => p.id}
            getCode={(p) => p.code}
            getLabel={(p) => p.label}
            getValue={(p) => p.value}
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center pt-20">
          {isEmpty ? (
            <div className="max-w-sm px-6 text-center">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600">
                Filtros vazios
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                Selecione ao menos uma{" "}
                {ufs.length === 0
                  ? "UF"
                  : cats.length === 0
                    ? "categoria"
                    : mode === "exp"
                      ? "destino"
                      : "origem"}{" "}
                pra visualizar o fluxo.
              </p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            >
              <defs>
                <linearGradient id="sk-grad" x1="0%" x2="100%">
                  <stop offset="0%" stopColor={activeColor} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={activeColor} stopOpacity="0.55" />
                </linearGradient>
              </defs>

              <text
                x={colX[0] + 7}
                y="18"
                fontSize="9"
                fill="rgba(180,190,220,0.7)"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                letterSpacing="1"
              >
                UF
              </text>
              <text
                x={colX[1] + 7}
                y="18"
                fontSize="9"
                fill="rgba(180,190,220,0.7)"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                letterSpacing="1"
              >
                CATEGORIA
              </text>
              <text
                x={colX[2] + 7}
                y="18"
                fontSize="9"
                fill="rgba(180,190,220,0.7)"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                letterSpacing="1"
              >
                {mode === "exp" ? "DESTINO" : "ORIGEM"}
              </text>

              {stacked.l1.map((l, i) => (
                <path
                  key={`l1-${i}`}
                  d={ribbonPath(l.from.x + l.from.w, l.fromY ?? 0, l.fromH ?? 0, l.to.x, l.toY ?? 0, l.toH ?? 0)}
                  fill="url(#sk-grad)"
                  opacity={isLink1Active(l) ? 0.55 : 0.06}
                />
              ))}
              {stacked.l2.map((l, i) => (
                <path
                  key={`l2-${i}`}
                  d={ribbonPath(l.from.x + l.from.w, l.fromY ?? 0, l.fromH ?? 0, l.to.x, l.toY ?? 0, l.toH ?? 0)}
                  fill="url(#sk-grad)"
                  opacity={isLink2Active(l) ? 0.55 : 0.06}
                />
              ))}

              {ufNodes.map((n) => (
                <g
                  key={n.id}
                  onMouseEnter={() => setHovUF(n.id)}
                  onMouseLeave={() => setHovUF(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    fill={activeColor}
                    rx="2"
                    opacity={hovUF && hovUF !== n.id ? 0.3 : 1}
                  />
                  <text
                    x={n.x - 8}
                    y={n.y + n.h / 2 + 3}
                    textAnchor="end"
                    fontSize="10.5"
                    fill="rgba(235,240,255,0.9)"
                    fontWeight="500"
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x - 8}
                    y={n.y + n.h / 2 + 13}
                    textAnchor="end"
                    fontSize="8.5"
                    fill="rgba(180,190,220,0.55)"
                    fontFamily="var(--font-mono)"
                  >
                    {n.code} · {n.value.toFixed(1)}B
                  </text>
                </g>
              ))}
              {catNodes.map((n) => (
                <g
                  key={n.id}
                  onMouseEnter={() => setHovCat(n.id)}
                  onMouseLeave={() => setHovCat(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    fill={categoryById(n.id).color}
                    rx="2"
                    opacity={hovCat && hovCat !== n.id ? 0.3 : 1}
                  />
                  <text
                    x={n.x + n.w + 8}
                    y={n.y + n.h / 2 - 1}
                    fontSize="10.5"
                    fill="rgba(235,240,255,0.9)"
                    fontWeight="500"
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x + n.w + 8}
                    y={n.y + n.h / 2 + 11}
                    fontSize="9"
                    fill="rgba(180,190,220,0.55)"
                    fontFamily="var(--font-mono)"
                  >
                    {n.value.toFixed(1)}B
                  </text>
                </g>
              ))}
              {ctyNodes.map((n) => (
                <g
                  key={n.id}
                  onMouseEnter={() => setHovCty(n.id)}
                  onMouseLeave={() => setHovCty(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    fill={activeColor}
                    rx="2"
                    opacity={hovCty && hovCty !== n.id ? 0.3 : 1}
                  />
                  <text
                    x={n.x + n.w + 8}
                    y={n.y + n.h / 2 - 1}
                    fontSize="10.5"
                    fill="rgba(235,240,255,0.9)"
                    fontWeight="500"
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x + n.w + 8}
                    y={n.y + n.h / 2 + 11}
                    fontSize="9"
                    fill="rgba(180,190,220,0.55)"
                    fontFamily="var(--font-mono)"
                  >
                    {n.code} · {n.value.toFixed(1)}B
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </main>

      <aside className="flex flex-col overflow-hidden border-l border-slate-800/60 bg-slate-950/40">
        <div className="scroll-list flex-1 overflow-y-auto px-4 pt-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Como ler
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-slate-200">Sankey de fluxo</div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            Cada barra é um nó (UF, categoria ou país). Largura proporcional ao valor FOB.
            Passe o mouse pra destacar fluxos.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["UFs", ufNodes.length],
              ["Cat.", catNodes.length],
              ["Países", ctyNodes.length],
            ].map(([l, v]) => (
              <div
                key={String(l)}
                className="rounded border border-slate-800/60 bg-slate-900/50 px-2 py-2"
              >
                <div className="text-[9px] uppercase tracking-wider text-slate-500">{l}</div>
                <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-100">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-[10px] uppercase tracking-wider text-slate-500">Top fluxo</div>
          {dominantTriple ? (
            <div className="mt-2 rounded border border-slate-800/60 bg-slate-900/50 p-3">
              <div className="text-[12px] text-slate-300">
                <span className="font-medium text-slate-100">{dominantTriple.uf.label}</span>
                <span className="text-slate-500"> → </span>
                <span className="font-medium text-slate-100">{dominantTriple.cat.label}</span>
                <span className="text-slate-500"> → </span>
                <span className="font-medium text-slate-100">{dominantTriple.cty.label}</span>
              </div>
              <div className="mt-2 font-mono text-[11px] tabular-nums" style={{ color: activeColor }}>
                ≈ {formatUSD(dominantTriple.v * 1e9)}
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded border border-slate-800/60 bg-slate-900/50 p-3 text-[11.5px] text-slate-500">
              Selecione filtros pra ver o fluxo dominante.
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/40 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Cypher</div>
          <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-slate-400">
{`MATCH (s:State)<-[:FROM_STATE]-(tf:TradeFlow {
  year:${YEAR}, direction:"${mode === "exp" ? "EXP" : "IMP"}"
})-[:TO_COUNTRY]->(c:Country),
  (tf)-[:OF_CHAPTER]->(ch:Chapter)
RETURN s.uf, ch.code, c.iso3, sum(tf.fob_usd)`}
          </pre>
        </div>
      </aside>
    </div>
  );
}
