"use client";

import type { Mode } from "@/components/types";

export type KPITotals = {
  exportacao_usd: number;
  importacao_usd: number;
  saldo_usd: number;
  corrente_usd: number;
};

export type KPIsProps = {
  totals: KPITotals;
  mode: Mode;
  year: number;
};

function inBillions(n: number): number {
  return n / 1e9;
}

export default function KPIs({ totals, mode, year }: KPIsProps) {
  const items = [
    {
      label: "Exportação",
      value: inBillions(totals.exportacao_usd),
      active: mode === "exp",
      tone: "emerald" as const,
    },
    {
      label: "Importação",
      value: inBillions(totals.importacao_usd),
      active: mode === "imp",
      tone: "violet" as const,
    },
    {
      label: "Saldo comercial",
      value: inBillions(totals.saldo_usd),
      tone: totals.saldo_usd >= 0 ? ("emerald" as const) : ("rose" as const),
      sign: true,
    },
    {
      label: "Corrente",
      value: inBillions(totals.corrente_usd),
      tone: "slate" as const,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-px border-y border-slate-800/60 bg-slate-800/60">
      {items.map((it) => (
        <div
          key={it.label}
          className={`bg-slate-950/80 p-4 backdrop-blur-sm transition-colors ${
            it.active ? "ring-1 ring-inset ring-slate-700" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {it.label}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-semibold tabular-nums tracking-tight ${
                it.tone === "emerald"
                  ? "text-emerald-200"
                  : it.tone === "violet"
                    ? "text-violet-200"
                    : it.tone === "rose"
                      ? "text-rose-200"
                      : "text-slate-200"
              }`}
            >
              {it.sign && it.value > 0 ? "+" : ""}
              US$ {it.value.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-slate-500">bi · {year}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
