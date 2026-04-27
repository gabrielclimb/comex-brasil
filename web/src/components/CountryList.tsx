"use client";

import { useMemo } from "react";
import { Badge } from "@/components/primitives";
import { iso2For } from "@/lib/format";
import type { Mode } from "@/components/types";
import type { Partner } from "@/app/api/partners/route";

export type CountryListProps = {
  partners: Partner[];
  mode: Mode;
  selected: string | null;
  hovered: string | null;
  onSelect: (iso: string | null) => void;
  onHover: (iso: string | null) => void;
};

export default function CountryList({
  partners,
  mode,
  selected,
  hovered,
  onSelect,
  onHover,
}: CountryListProps) {
  const sorted = useMemo(() => {
    return [...partners].sort((a, b) =>
      mode === "exp" ? b.exp_usd - a.exp_usd : b.imp_usd - a.imp_usd,
    );
  }, [partners, mode]);
  const max = useMemo(() => {
    return Math.max(1, ...partners.map((p) => (mode === "exp" ? p.exp_usd : p.imp_usd)));
  }, [partners, mode]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Top parceiros
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-slate-200">
            {mode === "exp" ? "Destinos das exportações" : "Origens das importações"}
          </div>
        </div>
        <Badge tone="neutral">{partners.length}</Badge>
      </div>
      <div className="scroll-list flex-1 overflow-y-auto px-2 pb-4">
        {sorted.map((p, i) => {
          const value = mode === "exp" ? p.exp_usd : p.imp_usd;
          const pct = (value / max) * 100;
          const isSel = selected === p.iso3;
          const isHov = hovered === p.iso3;
          const colorClass = mode === "exp" ? "bg-emerald-500/60" : "bg-violet-500/60";
          const iso2 = iso2For(p.iso3) ?? p.iso3.slice(0, 2);
          return (
            <button
              key={p.iso3}
              onMouseEnter={() => onHover(p.iso3)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(isSel ? null : p.iso3)}
              className={`group w-full rounded-md px-2 py-2 text-left transition-colors ${
                isSel
                  ? "bg-slate-800/80"
                  : isHov
                    ? "bg-slate-800/40"
                    : "hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 font-mono text-[10px] tabular-nums text-slate-600">
                  {i + 1}
                </span>
                <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-slate-400">
                  {iso2}
                </span>
                <span
                  className={`flex-1 truncate text-[12.5px] ${
                    isSel
                      ? "font-medium text-slate-100"
                      : "text-slate-300 group-hover:text-slate-200"
                  }`}
                >
                  {p.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-slate-400">
                  {(value / 1e9).toFixed(1)}
                </span>
              </div>
              <div className="ml-9 mt-1.5 h-0.5 overflow-hidden rounded-full bg-slate-800/60">
                <div
                  className={`h-full rounded-full transition-all ${colorClass}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
