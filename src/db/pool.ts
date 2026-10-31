import { Pool } from "pg";

const globalForPool = globalThis as typeof globalThis & {
  __tvtvPool?: Pool;
};

/**
 * Lazy singleton pool. DATABASE_URL is only required when the pool is
 * actually first used — importing this module at build time is safe.
 */
export function getPool(): Pool {
  if (!globalForPool.__tvtvPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required at runtime");
    }
    globalForPool.__tvtvPool = new Pool({ connectionString: databaseUrl });
  }
  return globalForPool.__tvtvPool;
}
