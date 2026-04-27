"use client";

import { useEffect, useMemo, useState } from "react";
import type { Mode } from "@/components/types";

type SavedQuery = { title: string; cypher: string };

const SAMPLE_QUERIES: SavedQuery[] = [
  {
    title: "Top 10 destinos exportação 2024",
    cypher: `MATCH (tf:TradeFlow {year:2024, direction:"EXP"})-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
RETURN c.name AS pais, sum(tf.fob_usd) AS fob_usd
ORDER BY fob_usd DESC
LIMIT 10`,
  },
  {
    title: "Saldo bilateral por parceiro",
    cypher: `MATCH (tf:TradeFlow {year:2024})-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
WITH c.iso3 AS iso3, c.name AS pais,
     sum(CASE WHEN tf.direction="EXP" THEN tf.fob_usd ELSE 0 END) AS exp,
     sum(CASE WHEN tf.direction="IMP" THEN tf.fob_usd ELSE 0 END) AS imp
RETURN iso3, pais, exp - imp AS saldo
ORDER BY saldo DESC
LIMIT 15`,
  },
  {
    title: "Top capítulos NCM exportados pra China",
    cypher: `MATCH (tf:TradeFlow {year:2024, direction:"EXP"})-[:TO_COUNTRY]->(c:Country {iso3:"CHN"})
MATCH (tf)-[:OF_CHAPTER]->(ch:Chapter)
RETURN ch.code AS chapter, ch.description AS descricao, sum(tf.fob_usd) AS fob
ORDER BY fob DESC
LIMIT 15`,
  },
  {
    title: "Saldo SP por país",
    cypher: `MATCH (s:State {uf:"SP"})<-[:FROM_STATE]-(tf:TradeFlow {year:2024})-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
RETURN c.iso3 AS iso3, c.name AS pais,
       sum(CASE WHEN tf.direction="EXP" THEN tf.fob_usd ELSE 0 END) AS exp,
       sum(CASE WHEN tf.direction="IMP" THEN tf.fob_usd ELSE 0 END) AS imp
ORDER BY exp DESC
LIMIT 15`,
  },
];

const SCHEMA_NODES = [
  ["(:Country)", 281],
  ["(:State)", 34],
  ["(:Chapter)", 97],
  ["(:Section)", 21],
  ["(:Year)", 1],
  ["(:TradeFlow)", 85672],
];

const SCHEMA_RELS = [
  ["[:TO_COUNTRY]", 85672],
  ["[:FROM_STATE]", 85672],
  ["[:OF_CHAPTER]", 85672],
  ["[:IN_YEAR]", 85672],
  ["[:IN_SECTION]", 96],
];

type CypherResponse = {
  cols?: string[];
  rows?: Array<Record<string, unknown>>;
  truncated?: boolean;
  took_ms: number;
  error?: string;
};

function highlight(query: string): React.ReactNode {
  const tokenRe =
    /(MATCH|RETURN|WHERE|ORDER\s+BY|LIMIT|AS|AND|OR|DESC|ASC|STARTS\s+WITH|CASE|WHEN|THEN|ELSE|END|WITH|UNWIND|sum|count|avg|max|min)\b|(\/\/.*)|("[^"]*")|(\d+(?:\.\d+)?)|(\w+)|([(){}\[\]\->:.,=])|(\s+)/gi;
  const out: Array<{ kind: string; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(query))) {
    if (m[1]) out.push({ kind: "kw", text: m[0] });
    else if (m[2]) out.push({ kind: "cm", text: m[0] });
    else if (m[3]) out.push({ kind: "st", text: m[0] });
    else if (m[4]) out.push({ kind: "nu", text: m[0] });
    else if (m[5]) out.push({ kind: "id", text: m[0] });
    else if (m[6]) out.push({ kind: "op", text: m[0] });
    else out.push({ kind: "ws", text: m[0] });
  }
  const cls: Record<string, string> = {
    kw: "text-violet-300 font-medium",
    cm: "text-slate-600 italic",
    st: "text-emerald-300",
    nu: "text-amber-300",
    id: "text-slate-200",
    op: "text-slate-500",
    ws: "",
  };
  return out.map((t, i) => (
    <span key={i} className={cls[t.kind] ?? ""}>
      {t.text}
    </span>
  ));
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function CypherView({ mode }: { mode: Mode }) {
  void mode; // mode unused but keeps API consistent across views
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState(SAMPLE_QUERIES[0].cypher);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CypherResponse | null>(null);

  useEffect(() => {
    if (!editing) setQuery(SAMPLE_QUERIES[active].cypher);
  }, [active, editing]);

  const run = async () => {
    setRunning(true);
    try {
      const r = await fetch("/api/cypher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = (await r.json()) as CypherResponse;
      setResult(json);
    } finally {
      setRunning(false);
    }
  };

  // Auto-run on first mount and when active changes (unless user is editing)
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const cols = result?.cols ?? [];
  const rows = result?.rows ?? [];

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  };

  const tokenized = useMemo(() => highlight(query), [query]);

  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "260px 1fr" }}>
      <aside className="scroll-list overflow-y-auto border-r border-slate-800/60 bg-slate-950/40">
        <div className="px-4 pt-4 pb-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Queries
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-slate-200">Favoritas</div>
        </div>
        <div className="px-2 pb-4">
          {SAMPLE_QUERIES.map((q, i) => (
            <button
              key={q.title}
              onClick={() => {
                setActive(i);
                setEditing(false);
              }}
              className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                active === i ? "bg-slate-800/80" : "hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={active === i ? "#a5b4fc" : "#64748b"}
                  strokeWidth="2.5"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                <span
                  className={`text-[12.5px] ${
                    active === i ? "font-medium text-slate-100" : "text-slate-300"
                  }`}
                >
                  {q.title}
                </span>
              </div>
              <div className="ml-5 mt-1 truncate font-mono text-[10px] text-slate-500">
                {q.cypher.split("\n")[0]}
              </div>
            </button>
          ))}
        </div>
        <div className="mx-4 my-2 rounded border border-slate-800/60 bg-slate-900/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Schema</div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            {SCHEMA_NODES.map(([label, n]) => (
              <div key={String(label)}>
                <span className="text-emerald-300">{String(label)}</span>
                <span className="text-slate-500"> {n.toLocaleString("pt-BR")}</span>
              </div>
            ))}
            <div className="mt-1 border-t border-slate-800/60 pt-1">
              {SCHEMA_RELS.map(([label, n]) => (
                <div key={String(label)}>
                  <span className="text-violet-300">{String(label)}</span>
                  <span className="text-slate-500"> {n.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex h-10 items-center justify-between border-b border-slate-800/40 px-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-500">$</span>
              <span className="text-[11.5px] font-medium text-slate-300">
                {SAMPLE_QUERIES[active].title}
                {editing && <span className="ml-2 text-[10px] text-amber-400">(editado)</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setQuery(SAMPLE_QUERIES[active].cypher);
                  setEditing(false);
                }}
                className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                Resetar
              </button>
              <button
                onClick={run}
                disabled={running}
                className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11.5px] font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Executar <span className="font-mono text-[9.5px] opacity-60">⌘↵</span>
              </button>
            </div>
          </div>
          <div className="relative px-5 py-4">
            <pre className="pointer-events-none m-0 whitespace-pre-wrap font-mono text-[12.5px] leading-[1.65] tabular-nums">
              {tokenized}
            </pre>
            <textarea
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setEditing(true);
              }}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className="absolute inset-0 resize-none bg-transparent px-5 py-4 font-mono text-[12.5px] leading-[1.65] text-transparent caret-slate-100 outline-none"
              style={{ caretColor: "#cbd5f5" }}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[#0a0d18]">
          <div className="flex h-9 items-center gap-1 border-b border-slate-800/60 px-4">
            {["Tabela", "Texto"].map((t, i) => (
              <button
                key={t}
                className={`rounded px-2.5 py-1 text-[11px] ${
                  i === 0
                    ? "bg-slate-800/80 font-medium text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3 font-mono text-[10.5px] text-slate-500">
              {running ? (
                <span className="text-amber-300">Executando…</span>
              ) : result?.error ? (
                <span className="text-rose-400">erro</span>
              ) : (
                <span>
                  {rows.length} linhas{result?.truncated ? "+" : ""} ·{" "}
                  {result?.took_ms ?? 0} ms
                </span>
              )}
            </div>
          </div>
          <div className="scroll-list flex-1 overflow-auto">
            {result?.error ? (
              <div className="p-6 font-mono text-[12px] text-rose-300">{result.error}</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-slate-900/80 backdrop-blur">
                  <tr className="border-b border-slate-800">
                    {cols.map((c) => (
                      <th
                        key={c}
                        className="px-4 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                      {cols.map((c, j) => (
                        <td
                          key={c}
                          className={`px-4 py-2 ${
                            j === 0 ? "text-slate-200" : "tabular-nums text-slate-400"
                          }`}
                        >
                          {formatCell(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex h-7 items-center border-t border-slate-800/60 bg-slate-950/60 px-4 font-mono text-[10px] text-slate-500">
            <span>{process.env.NEXT_PUBLIC_NEO4J_URI ?? "neo4j://localhost:7687"}</span>
            <span className="mx-2">·</span>
            <span>db: comex</span>
            <span className="mx-2">·</span>
            <span className="text-emerald-400">conectado</span>
            <span className="ml-auto">v5</span>
          </div>
        </div>
      </main>
    </div>
  );
}
