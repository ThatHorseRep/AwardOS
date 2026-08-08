import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// One socket per instance. postgres.js defaults to a pool of 10, which on a
// serverless platform means 10 sockets per warm lambda — enough concurrent
// lambdas will exhaust the Supabase pooler and start refusing connections.
// Transaction-mode pooling makes a per-instance pool pointless anyway.
const poolConfig = {
  prepare: false, // prefetch is unsupported in "Transaction" pool mode
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
};

// Dev HMR re-evaluates this module on every edit, and each evaluation would
// otherwise open a fresh pool that the previous one never closes.
const globalForDb = globalThis as unknown as {
  __awardosPg?: ReturnType<typeof postgres>;
};

const client = globalForDb.__awardosPg ?? postgres(connectionString, poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__awardosPg = client;
}

export const db = drizzle(client, { schema });
