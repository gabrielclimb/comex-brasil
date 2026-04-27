"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import KPIs from "@/components/KPIs";
import CountryList from "@/components/CountryList";
import DetailPanel from "@/components/DetailPanel";
import Globe from "@/components/Globe";
import ProductView from "@/components/ProductView";
import SankeyView from "@/components/SankeyView";
import CypherView from "@/components/CypherView";
import TweaksPanel from "@/components/TweaksPanel";
import { DEFAULT_TWEAKS, type Mode, PALETTES, type Tweaks, type View } from "@/components/types";
import type { Partner, PartnersResponse } from "@/app/api/partners/route";
import type { DashboardCell, DashboardResponse } from "@/app/api/dashboard/route";

const YEAR = 2024;

export default function App() {
  const [mode, setMode] = useState<Mode>("exp");
  const [view, setView] = useState<View>("globe");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [rotation, setRotation] = useState({ lng: 40, lat: -10 });
  const [isPlaying, setIsPlaying] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULT_TWEAKS);
  const [showTweaks, setShowTweaks] = useState(false);
  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
    setTweaks((prev) => ({ ...prev, [key]: value }));

  // Restore tweaks from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("comex.tweaks");
      if (raw) setTweaks({ ...DEFAULT_TWEAKS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("comex.tweaks", JSON.stringify(tweaks));
    } catch {
      /* ignore */
    }
  }, [tweaks]);

  const [partnersResp, setPartnersResp] = useState<PartnersResponse | null>(null);
  const [cellsExp, setCellsExp] = useState<DashboardCell[]>([]);
  const [cellsImp, setCellsImp] = useState<DashboardCell[]>([]);

  // Fetch partners (KPIs + globe + list)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/partners?year=${YEAR}`)
      .then((r) => r.json())
      .then((d: PartnersResponse) => !cancelled && setPartnersResp(d));
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch dashboard cells for both directions (used by DetailPanel)
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/dashboard?year=${YEAR}&dir=EXP`).then((r) => r.json() as Promise<DashboardResponse>),
      fetch(`/api/dashboard?year=${YEAR}&dir=IMP`).then((r) => r.json() as Promise<DashboardResponse>),
    ]).then(([exp, imp]) => {
      if (cancelled) return;
      setCellsExp(exp.cells);
      setCellsImp(imp.cells);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const partners: Partner[] = partnersResp?.partners ?? [];
  const totals = partnersResp?.totals ?? {
    exportacao_usd: 0,
    exportacao_kg: 0,
    importacao_usd: 0,
    importacao_kg: 0,
    saldo_usd: 0,
    corrente_usd: 0,
  };
  const palette = PALETTES[tweaks.palette];

  // Auto-rotate
  useEffect(() => {
    if (!isPlaying || !tweaks.autoRotate || dragging || view !== "globe") return;
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setRotation((r) => ({ ...r, lng: (r.lng + dt * 15 * tweaks.rotSpeed) % 360 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, dragging, tweaks.rotSpeed, tweaks.autoRotate, view]);

  // Drag to rotate
  const dragStart = useRef<{ x: number; y: number; rot: { lng: number; lat: number } } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY, rot: rotation };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRotation({
      lng: dragStart.current.rot.lng + dx * 0.35,
      lat: Math.max(-80, Math.min(80, dragStart.current.rot.lat - dy * 0.3)),
    });
  };
  const onMouseUp = () => {
    dragStart.current = null;
    setDragging(false);
  };

  const hoveredPartner = useMemo(
    () => partners.find((p) => p.iso3 === hovered) ?? null,
    [partners, hovered],
  );

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-200"
      onMouseMove={onMouseMove}
    >
      <TopBar
        mode={mode}
        setMode={setMode}
        view={view}
        setView={setView}
        onOpenSettings={() => setShowTweaks((s) => !s)}
      />
      {view === "globe" && (
        <KPIs
          totals={{
            exportacao_usd: totals.exportacao_usd,
            importacao_usd: totals.importacao_usd,
            saldo_usd: totals.saldo_usd,
            corrente_usd: totals.corrente_usd,
          }}
          mode={mode}
          year={YEAR}
        />
      )}

      {view === "product" && <ProductView mode={mode} palette={palette} />}
      {view === "sankey" && <SankeyView mode={mode} palette={palette} />}
      {view === "cypher" && <CypherView mode={mode} />}

      {view === "globe" && (
        <div
          className="grid min-h-0 flex-1"
          style={{ gridTemplateColumns: "280px 1fr 340px" }}
        >
          <aside className="overflow-hidden border-r border-slate-800/60 bg-slate-950/40">
            <CountryList
              partners={partners}
              mode={mode}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              onHover={setHovered}
            />
          </aside>

          <main
            className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-[#080912] to-slate-950"
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: dragging ? "grabbing" : "grab" }}
          >
            {/* Starfield */}
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,0.25), transparent), radial-gradient(1.5px 1.5px at 40% 60%, rgba(200,210,255,0.3), transparent), radial-gradient(1px 1px at 85% 20%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 10% 70%, rgba(200,210,255,0.25), transparent), radial-gradient(1px 1px at 50% 15%, rgba(255,255,255,0.2), transparent)",
                backgroundSize:
                  "400px 400px, 300px 300px, 500px 500px, 350px 350px, 450px 450px, 600px 600px",
              }}
            />

            {/* Headline top-left */}
            <div className="pointer-events-none absolute left-8 top-6 z-10 max-w-[280px]">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Fluxos comerciais · {YEAR}
              </div>
              <h1 className="mt-1 text-[28px] font-semibold leading-[1.05] tracking-tight text-slate-100">
                Como o Brasil se{" "}
                <span className={mode === "exp" ? "text-emerald-300" : "text-violet-300"}>
                  {mode === "exp" ? "vende" : "abastece"}
                </span>
                <br />
                <span className="text-slate-500">ao mundo</span>
              </h1>
              <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
                {mode === "exp"
                  ? `${(totals.exportacao_usd / 1e9).toFixed(0)} bilhões em exportações pra ${partners.length} países, mapeados como um grafo.`
                  : `${(totals.importacao_usd / 1e9).toFixed(0)} bilhões em importações vindas de ${partners.length} países, com China e EUA no topo.`}
              </p>
            </div>

            {/* Legend bottom-right */}
            <div className="pointer-events-none absolute bottom-6 right-8 z-10">
              <div className="text-right text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Escala FOB
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="font-mono text-[10px] text-slate-500">1B</span>
                <div
                  className="h-1 w-28 rounded-full"
                  style={{
                    background:
                      mode === "exp"
                        ? `linear-gradient(to right, oklch(0.72 0.14 ${palette.expHue} / 0.2), oklch(0.72 0.14 ${palette.expHue} / 1))`
                        : `linear-gradient(to right, oklch(0.70 0.14 ${palette.impHue} / 0.2), oklch(0.70 0.14 ${palette.impHue} / 1))`,
                  }}
                />
                <span className="font-mono text-[10px] text-slate-500">100B</span>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-100" />
                <span className="font-mono text-[10px] text-slate-400">BR origem</span>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ width: "min(78vh, 80%)", aspectRatio: "1/1" }}>
                <Globe
                  partners={partners}
                  mode={mode}
                  rotation={rotation}
                  hoveredIso={hovered}
                  selectedIso={selected}
                  onHover={setHovered}
                  onSelect={setSelected}
                  palette={palette}
                  arcLift={tweaks.arcLift}
                  arcOpacity={tweaks.arcOpacity}
                  animSpeed={tweaks.animSpeed}
                  showGraticule={tweaks.showGraticule}
                  showLabels={tweaks.showLabels}
                />
              </div>
            </div>

            {/* Globe overlay (bottom-center): play/pause + counts */}
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/80 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700"
                title={isPlaying ? "Pausar rotação" : "Rotacionar"}
                aria-label={isPlaying ? "Pausar" : "Rotacionar"}
              >
                {isPlaying ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>
              <div className="font-mono text-[11px] tabular-nums text-slate-400">
                <span className="text-slate-600">{YEAR} · </span>
                <span className={mode === "exp" ? "text-emerald-300" : "text-violet-300"}>
                  {mode === "exp" ? "EXP" : "IMP"}
                </span>
                <span className="text-slate-600"> · </span>
                <span className="text-slate-300">{partners.length} parceiros</span>
                {selected && (
                  <>
                    <span className="text-slate-600"> · </span>
                    <span className="text-slate-200">{selected}</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setRotation({ lng: 40, lat: -10 })}
                className="rounded px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                title="Centralizar no Brasil"
              >
                Centralizar
              </button>
            </div>
          </main>

          <aside className="overflow-hidden border-l border-slate-800/60 bg-slate-950/40">
            <DetailPanel
              selected={selected}
              partners={partners}
              mode={mode}
              cellsExp={cellsExp}
              cellsImp={cellsImp}
            />
          </aside>
        </div>
      )}

      {/* Tweaks panel */}
      {showTweaks && (
        <TweaksPanel tweaks={tweaks} setTweak={setTweak} onClose={() => setShowTweaks(false)} />
      )}

      {/* Hover tooltip */}
      {view === "globe" && hoveredPartner && (
        <div
          className="pointer-events-none fixed z-30 rounded-md border border-slate-800 bg-slate-900/95 px-3 py-2 shadow-xl shadow-black/50 backdrop-blur"
          style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
        >
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-slate-400">
              {hoveredPartner.iso3.slice(0, 2)}
            </span>
            <span className="text-[13px] font-medium text-slate-100">{hoveredPartner.name}</span>
          </div>
          <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
            <div className="flex items-center justify-between gap-6">
              <span className="text-slate-500">Exp BR →</span>
              <span className="text-emerald-300">
                US$ {(hoveredPartner.exp_usd / 1e9).toFixed(1)}B
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-slate-500">Imp BR ←</span>
              <span className="text-violet-300">
                US$ {(hoveredPartner.imp_usd / 1e9).toFixed(1)}B
              </span>
            </div>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-600">{hoveredPartner.region}</div>
        </div>
      )}
    </div>
  );
}
