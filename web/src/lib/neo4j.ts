import "server-only";

import neo4j, { Driver, Integer } from "neo4j-driver";

declare global {
  // eslint-disable-next-line no-var
  var __neo4j_driver: Driver | undefined;
}

function createDriver(): Driver {
  const uri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
  const user = process.env.NEO4J_USER ?? "neo4j";
  const password = process.env.NEO4J_PASSWORD;
  if (!password) {
    throw new Error("NEO4J_PASSWORD is required");
  }
  return neo4j.driver(uri, neo4j.auth.basic(user, password), {
    // Dev-friendly: don't hold connections for long; no encryption (local docker)
    maxConnectionPoolSize: 20,
    connectionAcquisitionTimeout: 10_000,
  });
}

// Re-use across hot reloads in dev. In prod the module is cached anyway.
export const driver: Driver = globalThis.__neo4j_driver ?? createDriver();
if (process.env.NODE_ENV !== "production") {
  globalThis.__neo4j_driver = driver;
}

export async function readTx<T>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

export function toNumber(v: unknown): number {
  // neo4j-driver returns Integer objects for int64 values
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (neo4j.isInt(v)) return (v as Integer).toNumber();
  return Number(v);
}
