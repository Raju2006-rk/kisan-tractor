import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { buildInitialDatabase } from "./initial-db";
import { getSupabaseAdmin, isSupabaseDatabaseConfigured } from "./supabase";
import type { Database } from "./types";

const STATE_ID = "main";
const MAX_WRITE_ATTEMPTS = 5;

const globalForDb = globalThis as unknown as {
  __ktDb?: Database;
  __ktQueue?: Promise<unknown>;
};

const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.NODE_ENV === "production";

const dataDir = isServerless
  ? path.join(os.tmpdir(), "kisantractor-data")
  : path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "db.json");

function normalizeDatabase(value: unknown): Database {
  const initial = buildInitialDatabase();
  if (!value || typeof value !== "object") return initial;
  const raw = value as Partial<Database>;
  return {
    ...initial,
    ...raw,
    equipment: raw.equipment?.length ? raw.equipment : initial.equipment,
  };
}

function assertDatabaseConfigured() {
  if (!isSupabaseDatabaseConfigured()) {
    console.warn(
      "[KisanTractor] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Operating with local database.",
    );
  }
}

async function writeLocalDatabase(db: Database) {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.warn("[db] Failed to write local database file, using memory state:", err);
  }
}

async function loadLocalDatabase(): Promise<Database> {
  if (globalForDb.__ktDb) return globalForDb.__ktDb;
  try {
    const raw = await fs.readFile(dbFile, "utf8");
    globalForDb.__ktDb = normalizeDatabase(JSON.parse(raw));
  } catch {
    const initial = buildInitialDatabase();
    await writeLocalDatabase(initial);
    globalForDb.__ktDb = initial;
  }
  return globalForDb.__ktDb;
}

async function readSupabaseState(): Promise<{ db: Database; version: number } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_state")
    .select("data, version")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205") {
      console.warn(
        "[KisanTractor] Supabase table 'app_state' not found. Run supabase/app_state.sql in the Supabase SQL editor. Using local fallback.",
      );
      return null;
    }
    throw new Error(
      `Could not read the Supabase app_state table (${error.message}). Run supabase/app_state.sql in the SQL editor.`,
    );
  }

  const rawData = data?.data && typeof data.data === "object" ? data.data : {};
  const isStateEmpty = Object.keys(rawData).length === 0;

  if (!data || isStateEmpty) {
    const initial = buildInitialDatabase();
    await supabase.from("app_state").upsert({
      id: STATE_ID,
      data: initial,
      version: 1,
      updated_at: new Date().toISOString(),
    });
    return { db: initial, version: 1 };
  }

  return {
    db: normalizeDatabase(data.data),
    version: Number(data.version) || 1,
  };
}

async function writeSupabaseState(
  db: Database,
  version: number,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_state")
    .update({
      data: db,
      version: version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", STATE_ID)
    .eq("version", version)
    .select("version")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not save to Supabase (${error.message}).`);
  }
  return Boolean(data);
}

export async function getDb(): Promise<Database> {
  assertDatabaseConfigured();
  if (isSupabaseDatabaseConfigured()) {
    try {
      const state = await readSupabaseState();
      if (state) return state.db;
    } catch (err) {
      console.warn("[KisanTractor] Supabase read error, using local fallback:", err);
    }
  }
  return loadLocalDatabase();
}

export async function mutateDb<T>(
  mutator: (db: Database) => T | Promise<T>,
): Promise<T> {
  assertDatabaseConfigured();

  if (isSupabaseDatabaseConfigured()) {
    try {
      const state = await readSupabaseState();
      if (state) {
        for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
          const fresh = (await readSupabaseState()) || state;
          const draft = structuredClone(fresh.db);
          const result = await mutator(draft);
          if (await writeSupabaseState(draft, fresh.version)) return result;
        }
        console.warn("[db] Supabase concurrent save conflict, continuing with memory state");
      }
    } catch (err) {
      console.warn("[KisanTractor] Supabase mutate error, using local fallback:", err);
    }
  }

  const previous = globalForDb.__ktQueue ?? Promise.resolve();
  const run = previous.then(async () => {
    const current = await loadLocalDatabase();
    const draft = structuredClone(current);
    const result = await mutator(draft);
    await writeLocalDatabase(draft);
    globalForDb.__ktDb = draft;
    return result;
  });
  globalForDb.__ktQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
