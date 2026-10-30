import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { buildSeedDatabase } from "./seed";
import type { Database } from "./types";

const globalForDb = globalThis as unknown as {
  __ktDb?: Database;
  __ktQueue?: Promise<unknown>;
};

// In serverless environments like Vercel, the workspace root is read-only.
// We fallback to os.tmpdir() in production/serverless environments.
const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.NODE_ENV === "production";

const dataDir = isServerless
  ? path.join(os.tmpdir(), "kisantractor-data")
  : path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "db.json");

async function writeDatabase(db: Database) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
}

async function loadDatabase(): Promise<Database> {
  if (globalForDb.__ktDb) return globalForDb.__ktDb;
  try {
    const raw = await fs.readFile(dbFile, "utf8");
    globalForDb.__ktDb = JSON.parse(raw) as Database;
  } catch {
    const seeded = buildSeedDatabase();
    await writeDatabase(seeded);
    globalForDb.__ktDb = seeded;
  }
  return globalForDb.__ktDb;
}

export async function getDb(): Promise<Database> {
  return loadDatabase();
}

export async function mutateDb<T>(
  mutator: (db: Database) => T | Promise<T>,
): Promise<T> {
  const previous = globalForDb.__ktQueue ?? Promise.resolve();
  const run = previous.then(async () => {
    const current = await loadDatabase();
    const draft = structuredClone(current);
    const result = await mutator(draft);
    await writeDatabase(draft);
    globalForDb.__ktDb = draft;
    return result;
  });
  globalForDb.__ktQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function resetDemoDatabase(): Promise<Database> {
  const seeded = buildSeedDatabase();
  await writeDatabase(seeded);
  globalForDb.__ktDb = seeded;
  return seeded;
}
