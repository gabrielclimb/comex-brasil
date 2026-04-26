"use client";

import { useEffect, useRef, useState } from "react";

export type MultiPickerProps<T> = {
  label: string;
  items: T[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  getId: (item: T) => string;
  getCode: (item: T) => string;
  getLabel: (item: T) => string;
  getValue: (item: T) => number;
  presets?: Array<{ label: string; ids: string[] }>;
};

export default function MultiPicker<T>({
  label,
  items,
  selected,
  onChange,
  getId,
  getCode,
  getLabel,
  getValue,
  presets = [],
}: MultiPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 whitespace-nowrap rounded-md border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[11.5px] text-slate-200 backdrop-blur hover:bg-slate-800/80"
      >
        <span className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono tabular-nums text-slate-300">
          {selected.size}/{items.length}
        </span>
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/95 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/60 px-3 py-2">
            <button
              onClick={() => onChange(new Set(items.map(getId)))}
              className="rounded px-2 py-1 text-[10.5px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Todos
            </button>
            <button
              onClick={() => onChange(new Set())}
              className="rounded px-2 py-1 text-[10.5px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Limpar
            </button>
            <button
              onClick={() => onChange(new Set(items.slice(0, 5).map(getId)))}
              className="rounded px-2 py-1 text-[10.5px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Top 5
            </button>
            <button
              onClick={() => onChange(new Set(items.slice(0, 10).map(getId)))}
              className="rounded px-2 py-1 text-[10.5px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Top 10
            </button>
          </div>
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b border-slate-800/60 px-3 py-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onChange(new Set(p.ids))}
                  className="rounded border border-slate-800 px-2 py-0.5 text-[10.5px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="scroll-list max-h-72 overflow-y-auto py-1">
            {items.map((it) => {
              const id = getId(it);
              const checked = selected.has(id);
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/60"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="accent-violet-500"
                  />
                  <span className="w-12 shrink-0 rounded bg-slate-800/80 px-1.5 py-0.5 text-center font-mono text-[10px] text-slate-400">
                    {getCode(it)}
                  </span>
                  <span className="flex-1 truncate text-[12px] text-slate-200">{getLabel(it)}</span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
                    {getValue(it).toFixed(1)}B
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
