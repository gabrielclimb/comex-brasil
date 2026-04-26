"use client";

import type { PaletteId, Tweaks } from "@/components/types";
import { PALETTES } from "@/components/types";

export type TweaksPanelProps = {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  onClose: () => void;
};

function Section({ label }: { label: string }) {
  return (
    <div className="mt-5 mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
      {label}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v: number) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] text-slate-300">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-slate-400">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-violet-500"
      />
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="text-[11.5px] text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-4 w-7 rounded-full transition-colors ${
          value ? "bg-violet-500/70" : "bg-slate-700"
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            value ? "left-[calc(100%-14px)]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function TweaksPanel({ tweaks, setTweak, onClose }: TweaksPanelProps) {
  return (
    <div className="fixed right-4 top-16 z-40 w-72 rounded-lg border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-black/60 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          Tweaks
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Fechar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
        </button>
      </div>

      <Section label="Aparência" />
      <label className="block">
        <div className="text-[11.5px] text-slate-300">Paleta</div>
        <select
          value={tweaks.palette}
          onChange={(e) => setTweak("palette", e.target.value as PaletteId)}
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[12px] text-slate-200"
        >
          {Object.keys(PALETTES).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <Toggle
        label="Graticule"
        value={tweaks.showGraticule}
        onChange={(v) => setTweak("showGraticule", v)}
      />
      <Toggle
        label="Labels país"
        value={tweaks.showLabels}
        onChange={(v) => setTweak("showLabels", v)}
      />

      <Section label="Arcos" />
      <Slider
        label="Altura"
        value={tweaks.arcLift}
        min={0.1}
        max={1.2}
        step={0.05}
        onChange={(v) => setTweak("arcLift", v)}
      />
      <Slider
        label="Opacidade"
        value={tweaks.arcOpacity}
        min={0.3}
        max={1}
        step={0.05}
        onChange={(v) => setTweak("arcOpacity", v)}
      />
      <Slider
        label="Velocidade pulso"
        value={tweaks.animSpeed}
        min={0.3}
        max={3}
        step={0.1}
        onChange={(v) => setTweak("animSpeed", v)}
      />

      <Section label="Rotação" />
      <Toggle
        label="Auto-rotacionar"
        value={tweaks.autoRotate}
        onChange={(v) => setTweak("autoRotate", v)}
      />
      <Slider
        label="Velocidade rotação"
        value={tweaks.rotSpeed}
        min={0}
        max={0.4}
        step={0.01}
        onChange={(v) => setTweak("rotSpeed", v)}
      />
    </div>
  );
}
