import { NextRequest, NextResponse } from "next/server";
import { driver, toNumber } from "@/lib/neo4j";
import neo4j, { Integer } from "neo4j-driver";

export const dynamic = "force-dynamic";

const DENY = /\b(CREATE|MERGE|DELETE|REMOVE|SET|DROP|DETACH|FOREACH|CALL\s+(?:dbms|apoc\.create|apoc\.merge|apoc\.refactor))\b/i;
const TIMEOUT_MS = 5000;
const MAX_ROWS = 1000;

function neo4jToJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return Number(value);
  if (neo4j.isInt(value)) return (value as Integer).toNumber();
  if (Array.isArray(value)) return value.map(neo4jToJson);
  if (typeof value === "object") {
    const v = value as { properties?: Record<string, unknown>; labels?: unknown; type?: unknown };
    if ("properties" in v && v.properties) {
      const props = Object.fromEntries(Object.entries(v.properties).map(([k, x]) => [k, neo4jToJson(x)]));
      return { _type: "labels" in v ? "node" : "rel", labels: v.labels, type: v.type, properties: props };
    }
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, x]) => [k, neo4jToJson(x)]));
  }
  return String(value);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });
  if (DENY.test(query)) {
    return NextResponse.json(
      { error: "Apenas queries de leitura são permitidas." },
      { status: 400 },
    );
  }

  const start = Date.now();
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.executeRead(
      (tx) => tx.run(query, {}),
      { timeout: TIMEOUT_MS },
    );
    const cols = result.records[0]?.keys ?? [];
    const rows = result.records.slice(0, MAX_ROWS).map((rec) => {
      const o: Record<string, unknown> = {};
      for (const k of rec.keys) {
        const key = String(k);
        const v = rec.get(key);
        // Compress numbers; keep raw structure for nodes/rels
        if (neo4j.isInt(v)) o[key] = toNumber(v);
        else o[key] = neo4jToJson(v);
      }
      return o;
    });
    return NextResponse.json({
      cols: cols.map(String),
      rows,
      truncated: result.records.length > MAX_ROWS,
      took_ms: Date.now() - start,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message, took_ms: Date.now() - start },
      { status: 400 },
    );
  } finally {
    await session.close();
  }
}
