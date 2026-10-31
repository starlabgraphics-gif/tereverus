import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getPool } from "./pool";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __tvtvDb?: Database;
};

function getDb(): Database {
  if (!globalForDb.__tvtvDb) {
    globalForDb.__tvtvDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__tvtvDb;
}

/**
 * Lazy proxy — the connection is created on the first real query, so
 * importing this module during a static build (page data collection)
 * never requires DATABASE_URL to be present.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const value = (getDb() as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(getDb())
      : value;
  },
});
