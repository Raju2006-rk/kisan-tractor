import { promises as fs } from "fs";
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

const dataDir = path.join(process.cwd(), "data");
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
  if (
    !isSupabaseDatabaseConfigured() &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_DB !== "true"
  ) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase/app_state.sql.",
    );
  }
}

async function writeLocalDatabase(db: Database) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
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

async function readSupabaseState(): Promise<{ db: Database; version: number }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_state")
    .select("data, version")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read the Supabase app_state table (${error.message}). Run supabase/app_state.sql in the SQL editor.`,
    );
  }

  if (!data) {
    const initial = buildInitialDatabase();
    const { error: insertError } = await supabase.from("app_state").insert({
      id: STATE_ID,
      data: initial,
      version: 1,
    });
    if (insertError && insertError.code !== "23505") {
      throw new Error(
        `Could not create the Supabase app_state row (${insertError.message}). Run supabase/app_state.sql in the SQL editor.`,
      );
    }
    if (insertError) return readSupabaseState();
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
    const { db } = await readSupabaseState();
    return db;
  }
  return loadLocalDatabase();
}

export async function mutateDb<T>(
  mutator: (db: Database) => T | Promise<T>,
): Promise<T> {
  assertDatabaseConfigured();

  if (isSupabaseDatabaseConfigured()) {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const { db, version } = await readSupabaseState();
      const draft = structuredClone(db);
      const result = await mutator(draft);
      if (await writeSupabaseState(draft, version)) return result;
    }
    throw new Error(
      "The database changed while saving. Please try again.",
    );
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
