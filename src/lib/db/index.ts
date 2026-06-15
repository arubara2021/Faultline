// ═══════════════════════════════════════════
// 1. src/lib/db/index.ts
// ═══════════════════════════════════════════

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __faultlinePool: Pool | undefined;
  var __faultlineDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    statement_timeout: 30000,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 3000,
  });

  pool.on("error", (err) => {
    console.error("[DB] Pool error:", err.message);
  });

  return pool;
}

let pool: Pool;
let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (process.env.NODE_ENV === "production") {
  pool = createPool();
  dbInstance = drizzle(pool, { schema });
} else {
  if (!globalThis.__faultlinePool) {
    globalThis.__faultlinePool = createPool();
    globalThis.__faultlineDb = drizzle(globalThis.__faultlinePool, { schema });
  }
  pool = globalThis.__faultlinePool;
  dbInstance = globalThis.__faultlineDb!;
}

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_, prop, receiver) {
      return Reflect.get(dbInstance, prop, receiver);
    },
    set(_, prop, value) {
      return Reflect.set(dbInstance, prop, value);
    },
  }
);

async function validateAndRepairPool(): Promise<Pool> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return pool;
  } catch {
    console.warn("[DB] Pool validation failed, recreating...");
    try {
      await pool.end().catch(() => {});
    } catch {}

    const fresh = createPool();
    const newDb = drizzle(fresh, { schema });

    pool = fresh;
    dbInstance = newDb;

    if (process.env.NODE_ENV !== "production") {
      globalThis.__faultlinePool = fresh;
      globalThis.__faultlineDb = newDb;
    }

    return fresh;
  }
}

export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const msg = (error as Error).message?.toLowerCase() ?? "";
    const isConnectionError =
      msg.includes("connection terminated") ||
      msg.includes("connection timeout") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused");

    if (!isConnectionError) throw error;

    console.warn("[DB] Connection error, repairing pool and retrying...");
    await validateAndRepairPool();
    return await fn();
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const p = await validateAndRepairPool();
    const client = await p.connect();
    client.release();
    return true;
  } catch (error) {
    console.error("[DB] Connection check failed:", error);
    return false;
  }
}

export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    if (process.env.NODE_ENV !== "production") {
      globalThis.__faultlinePool = undefined;
      globalThis.__faultlineDb = undefined;
    }
  } catch (error) {
    console.error("[DB] Error closing pool:", error);
  }
}
