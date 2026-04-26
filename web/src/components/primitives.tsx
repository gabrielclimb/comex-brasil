import type { ReactNode } from "react";

type Tone = "neutral" | "green" | "violet" | "amber";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-800/60 text-slate-300 border-slate-700/60",
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/25",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/25",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
