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

const primaryDataDir = path.join(process.cwd(), "data");
const fallbackDataDir = path.join(os.tmpdir(), "kisantractor-data");
const primaryDbFile = path.join(primaryDataDir, "db.json");
const fallbackDbFile = path.join(fallbackDataDir, "db.json");

function normalizeDatabase(value: unknown): Database {
  const initial = buildInitialDatabase();
  if (!value || typeof value !== "object") return initial;
  const raw = value as Partial<Database>;
  const baseEquipment = Array.isArray(raw.equipment) && raw.equipment.length > 0
    ? [...raw.equipment]
    : [...initial.equipment];
  for (const catEq of initial.equipment) {
    if (!baseEquipment.some((e) => e.id === catEq.id)) {
      baseEquipment.push(catEq);
    }
  }
  return {
    ...initial,
    ...raw,
    equipment: baseEquipment,
  };
}

let hasWarnedDatabaseConfig = false;
function assertDatabaseConfigured() {
  if (!isSupabaseDatabaseConfigured() && !hasWarnedDatabaseConfig) {
    hasWarnedDatabaseConfig = true;
    console.warn(
      "[KisanTractor] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Operating with local database.",
    );
  }
}

async function writeLocalDatabase(db: Database) {
  try {
    await fs.mkdir(primaryDataDir, { recursive: true });
    await fs.writeFile(primaryDbFile, JSON.stringify(db, null, 2), "utf8");
    return;
  } catch {
    // If workspace directory is read-only (e.g. AWS Lambda / Vercel read-only root), fall back to /tmp
  }
  try {
    await fs.mkdir(fallbackDataDir, { recursive: true });
    await fs.writeFile(fallbackDbFile, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.warn("[db] Failed to write local database file, using memory state:", err);
  }
}

async function loadLocalDatabase(): Promise<Database> {
  if (globalForDb.__ktDb) return globalForDb.__ktDb;
  for (const file of [primaryDbFile, fallbackDbFile]) {
    try {
      const raw = await fs.readFile(file, "utf8");
      globalForDb.__ktDb = normalizeDatabase(JSON.parse(raw));
      return globalForDb.__ktDb;
    } catch {
      // Try next location
    }
  }
  const initial = buildInitialDatabase();
  await writeLocalDatabase(initial);
  globalForDb.__ktDb = initial;
  return globalForDb.__ktDb;
}

async function readSupabaseState(): Promise<{ db: Database; version: number } | null> {
  try {
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
      console.warn(
        `[KisanTractor] Could not read the Supabase app_state table (${error.message}). Using local fallback.`,
      );
      return null;
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
  } catch (err) {
    console.warn("[KisanTractor] Supabase network error in readSupabaseState, using local fallback:", err);
    return null;
  }
}

async function writeSupabaseState(
  db: Database,
  version: number,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("app_state").upsert({
      id: STATE_ID,
      data: db,
      version: version + 1,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(`[KisanTractor] Supabase write error (${error.message}).`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[KisanTractor] Supabase network error in writeSupabaseState:", err);
    return false;
  }
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
          const saved = await writeSupabaseState(draft, fresh.version);
          if (saved) {
            // Guarantee local storage & memory mirror Supabase state
            await writeLocalDatabase(draft);
            globalForDb.__ktDb = draft;
            return result;
          }
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
