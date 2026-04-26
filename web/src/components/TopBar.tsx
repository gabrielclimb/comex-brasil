"use client";

import type { Mode, View } from "@/components/types";

export type TopBarProps = {
  mode: Mode;
  setMode: (m: Mode) => void;
  view: View;
  setView: (v: View) => void;
  onOpenSettings: () => void;
};

const NAV: Array<{ id: View; label: string }> = [
  { id: "globe", label: "Globo" },
  { id: "product", label: "Produto" },
  { id: "sankey", label: "Sankey" },
  { id: "cypher", label: "Cypher" },
];

export default function TopBar({ mode, setMode, view, setView, onOpenSettings }: TopBarProps) {
  return (
    <header className="relative z-20 flex h-14 items-center justify-between border-b border-slate-800/60 bg-slate-950/40 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-violet-500/20">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0d0f1a" strokeWidth="2.5">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="12" cy="18" r="2.5" />
            <path d="M6 6 L12 18 M18 6 L12 18 M6 6 L18 6" />
          </svg>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-slate-100">Neo4j Comex</span>
          <span className="text-[11px] font-medium text-slate-500">
            Grafo de Comércio Exterior · BR
          </span>
        </div>
      </div>

      <nav className="flex items-center gap-1">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
              view === item.id
                ? "bg-slate-800/80 font-medium text-slate-100"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-slate-800 bg-slate-900/80 p-0.5">
          <button
            onClick={() => setMode("exp")}
            className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              mode === "exp" ? "bg-slate-800 text-emerald-300" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Exportação
          </button>
          <button
            onClick={() => setMode("imp")}
            className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              mode === "imp" ? "bg-slate-800 text-violet-300" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Importação
          </button>
        </div>

        <div className="h-6 w-px bg-slate-800" />

        <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />
          neo4j://localhost:7687
        </span>

        <button
          onClick={onOpenSettings}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/40 hover:text-slate-200"
          title="Ajustes"
          aria-label="Abrir ajustes"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
